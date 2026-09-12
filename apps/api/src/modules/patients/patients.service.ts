import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { BookAppointmentInput, UpdatePatientProfileInput } from "./patient.schema.js";

interface UserRow {
    id: string;
    name: string;
    email: string;
    created_at: Date;
}

interface PatientRow {
    id: string;
    owner_user_id: string;
    name: string;
    age: number;
    gender: "Male" | "Female" | "Other";
    patient_type: "Online" | "Walkin";
    doctor_id: string | null;
    created_at: Date;
}

export async function ensurePatientRecord(userId: string, email: string): Promise<string> {
    const existing = await pool.query<PatientRow>(
        'SELECT id FROM "Patient" WHERE owner_user_id = $1',
        [userId]
    );

    if (existing.rowCount && existing.rows[0]) {
        return existing.rows[0].id;
    }

    const userRes = await pool.query<UserRow>(
        'SELECT id, name, email FROM "User" WHERE id = $1 OR email = $2',
        [userId, email]
    );

    const userName = userRes.rows[0]?.name ?? "Patient";
    const resolvedUserId = userRes.rows[0]?.id ?? userId;

    const insertRes = await pool.query<PatientRow>(
        `INSERT INTO "Patient" (owner_user_id, name, age, gender, patient_type)
         VALUES ($1, $2, 0, 'Other', 'Online')
         RETURNING id`,
        [resolvedUserId, userName]
    );

    const row = insertRes.rows[0];
    if (!row) {
        throw new AppError("Failed to initialize patient record", 500);
    }
    return row.id;
}

export async function getMyProfileService(userId: string, email: string) {
    const result = await pool.query(
        `SELECT 
            p.id,
            COALESCE(p.owner_user_id, u.id) as owner_user_id,
            COALESCE(p.name, u.name) as name,
            u.email,
            p.age,
            p.gender,
            COALESCE(p.patient_type, 'Online') as patient_type,
            p.doctor_id,
            COALESCE(p.created_at, u.created_at) as created_at
         FROM "User" u
         LEFT JOIN "Patient" p ON p.owner_user_id = u.id
         WHERE u.id = $1 OR u.email = $2`,
        [userId, email]
    );

    if (result.rowCount === 0) {
        throw new AppError("Patient profile not found", 404);
    }

    return result.rows[0];
}

export async function updateMyProfileService(
    userId: string,
    email: string,
    data: UpdatePatientProfileInput
) {
    const userRes = await pool.query<UserRow>(
        'SELECT id, name FROM "User" WHERE id = $1 OR email = $2',
        [userId, email]
    );

    if (userRes.rowCount === 0 || !userRes.rows[0]) {
        throw new AppError("User not found", 404);
    }

    const resolvedUserId = userRes.rows[0].id;

    if (data.name) {
        await pool.query('UPDATE "User" SET name = $1 WHERE id = $2', [
            data.name,
            resolvedUserId,
        ]);
    }

    const patientRes = await pool.query<PatientRow>(
        'SELECT id, name, age, gender, patient_type, doctor_id FROM "Patient" WHERE owner_user_id = $1',
        [resolvedUserId]
    );

    if (patientRes.rowCount && patientRes.rows[0]) {
        const existing = patientRes.rows[0];
        const updated = await pool.query(
            `UPDATE "Patient"
             SET name = $1,
                 age = $2,
                 gender = $3,
                 patient_type = $4,
                 doctor_id = $5
             WHERE owner_user_id = $6
             RETURNING *`,
            [
                data.name ?? existing.name,
                data.age ?? existing.age,
                data.gender ?? existing.gender,
                data.patientType ?? existing.patient_type,
                data.doctorId !== undefined ? data.doctorId : existing.doctor_id,
                resolvedUserId,
            ]
        );
        return updated.rows[0];
    }

    const created = await pool.query(
        `INSERT INTO "Patient" (owner_user_id, name, age, gender, patient_type, doctor_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
            resolvedUserId,
            data.name ?? userRes.rows[0].name,
            data.age ?? 0,
            data.gender ?? "Other",
            data.patientType ?? "Online",
            data.doctorId ?? null,
        ]
    );

    return created.rows[0];
}

export async function getMyAppointmentsService(userId: string, email: string) {
    const appointmentsRes = await pool.query(
        `SELECT 
            a.id,
            a.start_time,
            a.end_time,
            a.created_at,
            d.id as doctor_id,
            d.name as doctor_name,
            d.specialization as doctor_specialization,
            d.department as doctor_department
         FROM "Appointment" a
         JOIN "Doctor" d ON a.doctor_id = d.id
         JOIN "Patient" p ON a.patient_id = p.id
         LEFT JOIN "User" u ON p.owner_user_id = u.id
         WHERE p.owner_user_id = $1 OR u.email = $2
         ORDER BY a.start_time DESC`,
        [userId, email]
    );

    return { appointments: appointmentsRes.rows };
}

export async function bookAppointmentService(
    userId: string,
    email: string,
    data: BookAppointmentInput
) {
    const patientId = await ensurePatientRecord(userId, email);

    const doctorRes = await pool.query(
        'SELECT id, name, specialization, department FROM "Doctor" WHERE id = $1',
        [data.doctorId]
    );

    if (doctorRes.rowCount === 0) {
        throw new AppError("Doctor not found", 404);
    }

    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        throw new AppError("Invalid start or end time format", 400);
    }

    if (startTime >= endTime) {
        throw new AppError("Appointment end time must be after start time", 400);
    }

    // Check for overlapping doctor appointments
    const conflictRes = await pool.query(
        `SELECT id FROM "Appointment"
         WHERE doctor_id = $1
           AND (
             (start_time <= $2 AND end_time > $2)
             OR (start_time < $3 AND end_time >= $3)
             OR (start_time >= $2 AND end_time <= $3)
           )`,
        [data.doctorId, startTime, endTime]
    );

    if (conflictRes.rowCount && conflictRes.rowCount > 0) {
        throw new AppError("The selected doctor is already booked for this time slot", 409);
    }

    const insertRes = await pool.query(
        `INSERT INTO "Appointment" (patient_id, doctor_id, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         RETURNING id, patient_id, doctor_id, start_time, end_time, created_at`,
        [patientId, data.doctorId, startTime, endTime]
    );

    return {
        ...insertRes.rows[0],
        doctor: doctorRes.rows[0],
    };
}

export async function cancelAppointmentService(userId: string, appointmentId: string) {
    const apptRes = await pool.query(
        `SELECT a.id, p.owner_user_id 
         FROM "Appointment" a
         JOIN "Patient" p ON a.patient_id = p.id
         WHERE a.id = $1`,
        [appointmentId]
    );

    if (apptRes.rowCount === 0 || !apptRes.rows[0]) {
        throw new AppError("Appointment not found", 404);
    }

    if (apptRes.rows[0].owner_user_id !== userId) {
        throw new AppError("You are not authorized to cancel this appointment", 403);
    }

    await pool.query('DELETE FROM "Appointment" WHERE id = $1', [appointmentId]);

    return { message: "Appointment cancelled successfully" };
}

export async function getMyConsultationsService(userId: string, email: string) {
    const consultationsRes = await pool.query(
        `SELECT 
            c.id,
            c.diagnosis,
            c.notes,
            c.treatment_plan,
            c.created_at,
            c.updated_at,
            d.id as doctor_id,
            d.name as doctor_name,
            d.specialization as doctor_specialization,
            d.department as doctor_department,
            a.start_time as appointment_time
         FROM "Consultation" c
         JOIN "Doctor" d ON c.doctor_id = d.id
         JOIN "Patient" p ON c.patient_id = p.id
         LEFT JOIN "Appointment" a ON c.appointment_id = a.id
         LEFT JOIN "User" u ON p.owner_user_id = u.id
         WHERE p.owner_user_id = $1 OR u.email = $2
         ORDER BY c.created_at DESC`,
        [userId, email]
    );

    const consultations = consultationsRes.rows;

    if (consultations.length > 0) {
        const consultationIds = consultations.map((c) => c.id);
        const prescriptionsRes = await pool.query(
            `SELECT id, consultation_id, medication, dosage, frequency, duration, instructions, created_at
             FROM "Prescription"
             WHERE consultation_id = ANY($1)`,
            [consultationIds]
        );

        const presByConsultation = new Map<string, unknown[]>();
        for (const pres of prescriptionsRes.rows) {
            const list = presByConsultation.get(pres.consultation_id) ?? [];
            list.push(pres);
            presByConsultation.set(pres.consultation_id, list);
        }

        for (const c of consultations) {
            c.prescriptions = presByConsultation.get(c.id) ?? [];
        }
    }

    return { consultations };
}

export async function getMyReportsService(userId: string, email: string) {
    const reportsRes = await pool.query(
        `SELECT 
            r.id,
            r.test_name,
            r.instructions,
            r.status,
            r.result,
            r.created_at,
            r.updated_at,
            d.id as doctor_id,
            d.name as doctor_name,
            d.department as doctor_department
         FROM "InvestigationOrder" r
         JOIN "Doctor" d ON r.doctor_id = d.id
         JOIN "Patient" p ON r.patient_id = p.id
         LEFT JOIN "User" u ON p.owner_user_id = u.id
         WHERE p.owner_user_id = $1 OR u.email = $2
         ORDER BY r.created_at DESC`,
        [userId, email]
    );

    return { reports: reportsRes.rows };
}

export async function getMyPrescriptionsService(userId: string, email: string) {
    const prescriptionsRes = await pool.query(
        `SELECT 
            pr.id,
            pr.consultation_id,
            pr.medication,
            pr.dosage,
            pr.frequency,
            pr.duration,
            pr.instructions,
            pr.created_at,
            d.id as doctor_id,
            d.name as doctor_name,
            d.specialization as doctor_specialization
         FROM "Prescription" pr
         JOIN "Doctor" d ON pr.doctor_id = d.id
         JOIN "Patient" p ON pr.patient_id = p.id
         LEFT JOIN "User" u ON p.owner_user_id = u.id
         WHERE p.owner_user_id = $1 OR u.email = $2
         ORDER BY pr.created_at DESC`,
        [userId, email]
    );

    return { prescriptions: prescriptionsRes.rows };
}

export interface JourneyEvent {
    type: "REGISTRATION" | "APPOINTMENT" | "CONSULTATION" | "LAB_ORDER" | "PRESCRIPTION";
    title: string;
    timestamp: Date;
    status?: string;
    details: Record<string, unknown>;
}

export async function getMyJourneyService(userId: string, email: string) {
    const events: JourneyEvent[] = [];

    // 1. User registration event
    const userRes = await pool.query<UserRow>(
        'SELECT id, name, email, created_at FROM "User" WHERE id = $1 OR email = $2',
        [userId, email]
    );

    if (userRes.rowCount && userRes.rows[0]) {
        events.push({
            type: "REGISTRATION",
            title: "Patient Registered",
            timestamp: userRes.rows[0].created_at,
            details: {
                name: userRes.rows[0].name,
                email: userRes.rows[0].email,
            },
        });
    }

    // 2. Appointments
    const appts = await getMyAppointmentsService(userId, email);
    for (const a of appts.appointments as Record<string, any>[]) {
        events.push({
            type: "APPOINTMENT",
            title: `Appointment with Dr. ${a.doctor_name}`,
            timestamp: new Date(a.start_time),
            status: "SCHEDULED",
            details: {
                appointmentId: a.id,
                doctorName: a.doctor_name,
                specialization: a.doctor_specialization,
                department: a.doctor_department,
                startTime: a.start_time,
                endTime: a.end_time,
            },
        });
    }

    // 3. Consultations
    const consults = await getMyConsultationsService(userId, email);
    for (const c of consults.consultations as Record<string, any>[]) {
        events.push({
            type: "CONSULTATION",
            title: `Consultation with Dr. ${c.doctor_name}`,
            timestamp: new Date(c.created_at),
            details: {
                consultationId: c.id,
                diagnosis: c.diagnosis,
                notes: c.notes,
                treatmentPlan: c.treatment_plan,
            },
        });
    }

    // 4. Lab Reports / Investigation Orders
    const reports = await getMyReportsService(userId, email);
    for (const r of reports.reports as Record<string, any>[]) {
        events.push({
            type: "LAB_ORDER",
            title: `Investigation Order: ${r.test_name}`,
            timestamp: new Date(r.created_at),
            status: r.status,
            details: {
                orderId: r.id,
                testName: r.test_name,
                status: r.status,
                result: r.result,
                instructions: r.instructions,
            },
        });
    }

    // 5. Prescriptions
    const prescriptions = await getMyPrescriptionsService(userId, email);
    for (const pr of prescriptions.prescriptions as Record<string, any>[]) {
        events.push({
            type: "PRESCRIPTION",
            title: `Prescription: ${pr.medication}`,
            timestamp: new Date(pr.created_at),
            details: {
                prescriptionId: pr.id,
                medication: pr.medication,
                dosage: pr.dosage,
                frequency: pr.frequency,
                duration: pr.duration,
                instructions: pr.instructions,
            },
        });
    }

    // Sort chronologically (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { journey: events };
}