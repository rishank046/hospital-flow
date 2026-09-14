import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type {
    BookAppointmentInput,
    CreatePatientProfileInput,
    UpdatePatientProfileInput,
} from "./patient.schema.js";

export async function listMyPatientsService(ownerUserId: string) {
    const res = await pool.query(
        `SELECT 
            id, 
            owner_user_id, 
            owner_user_id as user_id,
            name, 
            EXTRACT(YEAR FROM age(date_of_birth))::int as age, 
            date_of_birth,
            gender, 
            mobile_number,
            mobile_number as phone,
            address,
            'Online' as patient_type, 
            created_at
         FROM "patient_profiles"
         WHERE owner_user_id = $1
         ORDER BY created_at ASC`,
        [ownerUserId]
    );

    return { patients: res.rows };
}

export async function createPatientProfileService(
    ownerUserId: string,
    data: CreatePatientProfileInput
) {
    const dob = data.dateOfBirth
        ? new Date(data.dateOfBirth)
        : data.age !== undefined
        ? new Date(new Date().getFullYear() - data.age, 0, 1)
        : new Date(2000, 0, 1);

    const phone = data.phone || data.mobileNumber || data.mobile_number || null;

    const res = await pool.query(
        `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender, mobile_number, address)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING 
            id, 
            owner_user_id, 
            owner_user_id as user_id,
            name, 
            EXTRACT(YEAR FROM age(date_of_birth))::int as age, 
            date_of_birth,
            gender, 
            'Online' as patient_type, 
            mobile_number,
            mobile_number as phone,
            address,
            created_at`,
        [
            ownerUserId,
            data.name,
            dob,
            data.gender,
            phone,
            data.address ?? null,
        ]
    );

    return res.rows[0];
}

export async function getPatientProfileByIdService(
    ownerUserId: string,
    patientId: string,
    isStaff = false
) {
    const res = await pool.query(
        `SELECT 
            id, 
            owner_user_id, 
            owner_user_id as user_id,
            name, 
            EXTRACT(YEAR FROM age(date_of_birth))::int as age, 
            date_of_birth,
            gender, 
            mobile_number,
            mobile_number as phone,
            address,
            'Online' as patient_type, 
            created_at
         FROM "patient_profiles"
         WHERE id = $1`,
        [patientId]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Patient profile not found", 404);
    }

    const patient = res.rows[0];
    if (!isStaff && patient.owner_user_id !== ownerUserId) {
        throw new AppError("Forbidden: you do not have permission to access this patient profile", 403);
    }

    return patient;
}

export async function updatePatientProfileByIdService(
    ownerUserId: string,
    patientId: string,
    data: UpdatePatientProfileInput
) {
    const existing = await pool.query(
        'SELECT id, owner_user_id, name, date_of_birth, gender, mobile_number, address FROM "patient_profiles" WHERE id = $1',
        [patientId]
    );

    if (existing.rowCount === 0 || !existing.rows[0]) {
        throw new AppError("Patient profile not found", 404);
    }

    if (existing.rows[0].owner_user_id !== ownerUserId) {
        throw new AppError("Forbidden: you do not own this patient profile", 403);
    }

    const current = existing.rows[0];
    let dob = current.date_of_birth;
    if (data.dateOfBirth) {
        dob = new Date(data.dateOfBirth);
    } else if (data.age !== undefined) {
        dob = new Date(new Date().getFullYear() - data.age, 0, 1);
    }

    const phone = data.phone || data.mobileNumber || data.mobile_number || current.mobile_number;

    const updateRes = await pool.query(
        `UPDATE "patient_profiles"
         SET name = $1,
             date_of_birth = $2,
             gender = $3,
             mobile_number = $4,
             address = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING 
            id, 
            owner_user_id, 
            owner_user_id as user_id,
            name, 
            EXTRACT(YEAR FROM age(date_of_birth))::int as age, 
            date_of_birth,
            gender, 
            'Online' as patient_type, 
            mobile_number,
            mobile_number as phone,
            address,
            created_at`,
        [
            data.name ?? current.name,
            dob,
            data.gender ?? current.gender,
            phone,
            data.address ?? current.address,
            patientId,
        ]
    );

    return updateRes.rows[0];
}

export async function ensurePatientRecord(userId: string, email: string): Promise<string> {
    const existing = await pool.query<{ id: string }>(
        'SELECT id FROM "patient_profiles" WHERE owner_user_id = $1',
        [userId]
    );

    if (existing.rowCount && existing.rows[0]) {
        return existing.rows[0].id;
    }

    const userRes = await pool.query<{ id: string; name: string }>(
        'SELECT id, name FROM "users" WHERE id = $1 OR email = $2',
        [userId, email]
    );

    const userName = userRes.rows[0]?.name ?? "Patient";
    const resolvedUserId = userRes.rows[0]?.id ?? userId;

    const insertRes = await pool.query<{ id: string }>(
        `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender)
         VALUES ($1, $2, '2000-01-01', 'Other')
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
            p.owner_user_id,
            p.owner_user_id as user_id,
            COALESCE(p.name, u.name) as name,
            u.email,
            EXTRACT(YEAR FROM age(p.date_of_birth))::int as age,
            p.date_of_birth,
            p.gender,
            p.mobile_number,
            p.mobile_number as phone,
            p.address,
            'Online' as patient_type,
            COALESCE(p.created_at, u.created_at) as created_at
         FROM "users" u
         LEFT JOIN "patient_profiles" p ON p.owner_user_id = u.id
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
    const userRes = await pool.query<{ id: string; name: string }>(
        'SELECT id, name FROM "users" WHERE id = $1 OR email = $2',
        [userId, email]
    );

    if (userRes.rowCount === 0 || !userRes.rows[0]) {
        throw new AppError("User not found", 404);
    }

    const resolvedUserId = userRes.rows[0].id;

    if (data.name) {
        await pool.query('UPDATE "users" SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
            data.name,
            resolvedUserId,
        ]);
    }

    const patientRes = await pool.query(
        'SELECT id, name, date_of_birth, gender, mobile_number, address FROM "patient_profiles" WHERE owner_user_id = $1',
        [resolvedUserId]
    );

    const phone = data.phone || data.mobileNumber || data.mobile_number || null;

    if (patientRes.rowCount && patientRes.rows[0]) {
        const existing = patientRes.rows[0];
        let dob = existing.date_of_birth;
        if (data.dateOfBirth) {
            dob = new Date(data.dateOfBirth);
        } else if (data.age !== undefined) {
            dob = new Date(new Date().getFullYear() - data.age, 0, 1);
        }

        const effectivePhone = phone || existing.mobile_number;

        const updated = await pool.query(
            `UPDATE "patient_profiles"
             SET name = $1,
                 date_of_birth = $2,
                 gender = $3,
                 mobile_number = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE owner_user_id = $5
             RETURNING 
                id, 
                owner_user_id, 
                owner_user_id as user_id,
                name, 
                EXTRACT(YEAR FROM age(date_of_birth))::int as age, 
                date_of_birth,
                gender, 
                mobile_number,
                mobile_number as phone,
                address,
                'Online' as patient_type, 
                created_at`,
            [
                data.name ?? existing.name,
                dob,
                data.gender ?? existing.gender,
                effectivePhone,
                resolvedUserId,
            ]
        );
        return updated.rows[0];
    }

    const dob = data.dateOfBirth
        ? new Date(data.dateOfBirth)
        : data.age !== undefined
        ? new Date(new Date().getFullYear() - data.age, 0, 1)
        : new Date(2000, 0, 1);

    const created = await pool.query(
        `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender, mobile_number)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING 
            id, 
            owner_user_id, 
            owner_user_id as user_id,
            name, 
            EXTRACT(YEAR FROM age(date_of_birth))::int as age, 
            date_of_birth,
            gender, 
            mobile_number,
            mobile_number as phone,
            address,
            'Online' as patient_type, 
            created_at`,
        [
            resolvedUserId,
            data.name ?? userRes.rows[0].name,
            dob,
            data.gender ?? "Other",
            phone,
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
            a.type,
            a.status,
            a.created_at,
            d.id as doctor_id,
            doc_u.name as doctor_name,
            d.specialization as doctor_specialization,
            dept.name as doctor_department
         FROM "appointments" a
         JOIN "doctors" d ON a.doctor_id = d.id
         JOIN "staff_profiles" s ON d.staff_id = s.id
         JOIN "users" doc_u ON s.user_id = doc_u.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
         JOIN "patient_profiles" p ON a.patient_id = p.id
         LEFT JOIN "users" u ON p.owner_user_id = u.id
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
    let patientId = data.patientId;
    if (patientId) {
        const patCheck = await pool.query<{ owner_user_id: string }>(
            'SELECT owner_user_id FROM "patient_profiles" WHERE id = $1',
            [patientId]
        );
        if (patCheck.rowCount === 0 || !patCheck.rows[0]) {
            throw new AppError("Patient not found", 404);
        }
        if (patCheck.rows[0].owner_user_id && patCheck.rows[0].owner_user_id !== userId) {
            throw new AppError("Forbidden: you do not own this patient profile", 403);
        }
    } else {
        patientId = await ensurePatientRecord(userId, email);
    }

    const doctorRes = await pool.query(
        `SELECT 
            d.id, 
            doc_u.name as name, 
            d.specialization, 
            dept.name as department 
         FROM "doctors" d
         JOIN "staff_profiles" s ON d.staff_id = s.id
         JOIN "users" doc_u ON s.user_id = doc_u.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
         WHERE d.id = $1`,
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
        `SELECT id FROM "appointments"
         WHERE doctor_id = $1
           AND status != 'CANCELLED'
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

    const apptType = data.type === "FOLLOW_UP" || data.type === "PROCEDURE" ? data.type : "CONSULTATION";

    const insertRes = await pool.query(
        `INSERT INTO "appointments" (patient_id, doctor_id, start_time, end_time, type, status, booked_by_user_id)
         VALUES ($1, $2, $3, $4, $5, 'SCHEDULED', $6)
         RETURNING id, patient_id, doctor_id, start_time, end_time, type, status, created_at`,
        [patientId, data.doctorId, startTime, endTime, apptType, userId]
    );

    return {
        ...insertRes.rows[0],
        doctor: doctorRes.rows[0],
    };
}

export async function cancelAppointmentService(userId: string, appointmentId: string) {
    const apptRes = await pool.query(
        `SELECT a.id, p.owner_user_id 
         FROM "appointments" a
         JOIN "patient_profiles" p ON a.patient_id = p.id
         WHERE a.id = $1`,
        [appointmentId]
    );

    if (apptRes.rowCount === 0 || !apptRes.rows[0]) {
        throw new AppError("Appointment not found", 404);
    }

    if (apptRes.rows[0].owner_user_id && apptRes.rows[0].owner_user_id !== userId) {
        throw new AppError("You are not authorized to cancel this appointment", 403);
    }

    await pool.query('UPDATE "appointments" SET status = \'CANCELLED\', updated_at = CURRENT_TIMESTAMP WHERE id = $1', [appointmentId]);

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
            doc_u.name as doctor_name,
            d.specialization as doctor_specialization,
            dept.name as doctor_department,
            a.start_time as appointment_time
         FROM "consultations" c
         JOIN "visits" v ON c.visit_id = v.id
         JOIN "patient_profiles" p ON v.patient_id = p.id
         JOIN "doctors" d ON c.doctor_id = d.id
         JOIN "staff_profiles" s ON d.staff_id = s.id
         JOIN "users" doc_u ON s.user_id = doc_u.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
         LEFT JOIN "appointments" a ON c.appointment_id = a.id
         WHERE p.owner_user_id = $1 OR p.owner_user_id IN (SELECT id FROM "users" WHERE email = $2)
         ORDER BY c.created_at DESC`,
        [userId, email]
    );

    const consultations = consultationsRes.rows;

    if (consultations.length > 0) {
        const consultationIds = consultations.map((c) => c.id);
        const prescriptionsRes = await pool.query(
            `SELECT id, consultation_id, medication, dosage, frequency, duration, instructions, status, created_at
             FROM "prescriptions"
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
            doc_u.name as doctor_name,
            dept.name as doctor_department
         FROM "investigation_orders" r
         JOIN "visits" v ON r.visit_id = v.id
         JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "doctors" d ON r.doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
         WHERE p.owner_user_id = $1 OR p.owner_user_id IN (SELECT id FROM "users" WHERE email = $2)
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
            pr.status,
            pr.created_at,
            d.id as doctor_id,
            doc_u.name as doctor_name,
            d.specialization as doctor_specialization
         FROM "prescriptions" pr
         JOIN "visits" v ON pr.visit_id = v.id
         JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "doctors" d ON pr.doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
         WHERE p.owner_user_id = $1 OR p.owner_user_id IN (SELECT id FROM "users" WHERE email = $2)
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
    const userRes = await pool.query<{ id: string; name: string; email: string; created_at: Date }>(
        'SELECT id, name, email, created_at FROM "users" WHERE id = $1 OR email = $2',
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
