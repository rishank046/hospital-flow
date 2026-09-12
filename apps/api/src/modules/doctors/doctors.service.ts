import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type {
    CreateConsultationInput,
    CreateInvestigationOrderInput,
    DoctorLoginInput,
    UpdateConsultationInput,
    UpdateDoctorProfileInput,
} from "./doctor.schema.js";

interface DoctorRow {
    id: string;
    name: string;
    email: string;
    password: string;
    specialization: string;
    department: string;
    created_at: Date;
}

export async function doctorLoginService(data: DoctorLoginInput) {
    const result = await pool.query<DoctorRow>(
        'SELECT id, name, email, password, specialization, department, created_at FROM "Doctor" WHERE email = $1',
        [data.email]
    );

    if (result.rowCount === 0 || !result.rows[0]) {
        throw new AppError("Invalid email or password", 401);
    }

    const doctor = result.rows[0];
    const passwordMatch = await bcrypt.compare(data.password, doctor.password);

    if (!passwordMatch) {
        throw new AppError("Invalid email or password", 401);
    }

    const token = jwt.sign(
        {
            userId: doctor.id,
            email: doctor.email,
            role: "DOCTOR",
        },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: "8h" }
    );

    return {
        token,
        doctor: {
            id: doctor.id,
            name: doctor.name,
            email: doctor.email,
            specialization: doctor.specialization,
            department: doctor.department,
            createdAt: doctor.created_at,
        },
    };
}

export async function getDoctorProfileService(doctorId: string) {
    const result = await pool.query(
        'SELECT id, name, email, specialization, department, created_at FROM "Doctor" WHERE id = $1',
        [doctorId]
    );

    if (result.rowCount === 0 || !result.rows[0]) {
        throw new AppError("Doctor profile not found", 404);
    }

    return result.rows[0];
}

export async function updateDoctorProfileService(
    doctorId: string,
    data: UpdateDoctorProfileInput
) {
    const existing = await pool.query<DoctorRow>(
        'SELECT id, name, email, specialization, department FROM "Doctor" WHERE id = $1',
        [doctorId]
    );

    if (existing.rowCount === 0 || !existing.rows[0]) {
        throw new AppError("Doctor not found", 404);
    }

    const current = existing.rows[0];
    const updated = await pool.query(
        `UPDATE "Doctor"
         SET name = $1,
             specialization = $2,
             department = $3
         WHERE id = $4
         RETURNING id, name, email, specialization, department, created_at`,
        [
            data.name ?? current.name,
            data.specialization ?? current.specialization,
            data.department ?? current.department,
            doctorId,
        ]
    );

    return updated.rows[0];
}

export async function getDoctorScheduleService(doctorId: string) {
    const scheduleRes = await pool.query(
        `SELECT 
            a.id,
            a.start_time,
            a.end_time,
            a.created_at,
            p.id as patient_id,
            p.name as patient_name,
            p.age as patient_age,
            p.gender as patient_gender,
            p.patient_type
         FROM "Appointment" a
         JOIN "Patient" p ON a.patient_id = p.id
         WHERE a.doctor_id = $1
         ORDER BY a.start_time ASC`,
        [doctorId]
    );

    return { schedule: scheduleRes.rows };
}

export async function getDoctorPatientsService(doctorId: string) {
    const patientsRes = await pool.query(
        `SELECT DISTINCT ON (p.id)
            p.id,
            p.name,
            p.age,
            p.gender,
            p.patient_type,
            p.created_at,
            u.email as owner_email
         FROM "Patient" p
         LEFT JOIN "User" u ON p.owner_user_id = u.id
         LEFT JOIN "Appointment" a ON a.patient_id = p.id
         LEFT JOIN "Consultation" c ON c.patient_id = p.id
         WHERE p.doctor_id = $1 OR a.doctor_id = $1 OR c.doctor_id = $1
         ORDER BY p.id, p.created_at DESC`,
        [doctorId]
    );

    return { patients: patientsRes.rows };
}

export async function getDoctorPatientDetailsService(doctorId: string, patientId: string) {
    const patientRes = await pool.query(
        `SELECT 
            p.id,
            p.name,
            p.age,
            p.gender,
            p.patient_type,
            p.created_at,
            p.doctor_id,
            u.email as owner_email
         FROM "Patient" p
         LEFT JOIN "User" u ON p.owner_user_id = u.id
         WHERE p.id = $1`,
        [patientId]
    );

    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient not found", 404);
    }

    const patient = patientRes.rows[0];

    const appointmentsRes = await pool.query(
        `SELECT id, start_time, end_time, created_at
         FROM "Appointment"
         WHERE patient_id = $1 AND doctor_id = $2
         ORDER BY start_time DESC`,
        [patientId, doctorId]
    );

    const consultationsRes = await pool.query(
        `SELECT id, diagnosis, notes, treatment_plan, created_at, updated_at
         FROM "Consultation"
         WHERE patient_id = $1 AND doctor_id = $2
         ORDER BY created_at DESC`,
        [patientId, doctorId]
    );

    const prescriptionsRes = await pool.query(
        `SELECT id, consultation_id, medication, dosage, frequency, duration, instructions, created_at
         FROM "Prescription"
         WHERE patient_id = $1 AND doctor_id = $2
         ORDER BY created_at DESC`,
        [patientId, doctorId]
    );

    const reportsRes = await pool.query(
        `SELECT id, test_name, instructions, status, result, created_at, updated_at
         FROM "InvestigationOrder"
         WHERE patient_id = $1 AND doctor_id = $2
         ORDER BY created_at DESC`,
        [patientId, doctorId]
    );

    return {
        patient,
        appointments: appointmentsRes.rows,
        consultations: consultationsRes.rows,
        prescriptions: prescriptionsRes.rows,
        reports: reportsRes.rows,
    };
}

export async function createConsultationService(
    doctorId: string,
    patientId: string,
    data: CreateConsultationInput
) {
    const patientRes = await pool.query('SELECT id FROM "Patient" WHERE id = $1', [patientId]);
    if (patientRes.rowCount === 0) {
        throw new AppError("Patient not found", 404);
    }

    const consultRes = await pool.query(
        `INSERT INTO "Consultation" (doctor_id, patient_id, appointment_id, diagnosis, notes, treatment_plan)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
            doctorId,
            patientId,
            data.appointmentId ?? null,
            data.diagnosis,
            data.notes ?? null,
            data.treatmentPlan ?? null,
        ]
    );

    const consultation = consultRes.rows[0];
    const createdPrescriptions: unknown[] = [];

    if (data.prescriptions && data.prescriptions.length > 0) {
        for (const item of data.prescriptions) {
            const presRes = await pool.query(
                `INSERT INTO "Prescription" (consultation_id, patient_id, doctor_id, medication, dosage, frequency, duration, instructions)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [
                    consultation.id,
                    patientId,
                    doctorId,
                    item.medication,
                    item.dosage,
                    item.frequency ?? null,
                    item.duration ?? null,
                    item.instructions ?? null,
                ]
            );
            createdPrescriptions.push(presRes.rows[0]);
        }
    }

    return {
        ...consultation,
        prescriptions: createdPrescriptions,
    };
}

export async function updateConsultationService(
    doctorId: string,
    consultationId: string,
    data: UpdateConsultationInput
) {
    const consultRes = await pool.query(
        'SELECT id, doctor_id, diagnosis, notes, treatment_plan FROM "Consultation" WHERE id = $1',
        [consultationId]
    );

    if (consultRes.rowCount === 0 || !consultRes.rows[0]) {
        throw new AppError("Consultation not found", 404);
    }

    const existing = consultRes.rows[0];
    if (existing.doctor_id !== doctorId) {
        throw new AppError("You are not authorized to update this consultation", 403);
    }

    const updateRes = await pool.query(
        `UPDATE "Consultation"
         SET diagnosis = $1,
             notes = $2,
             treatment_plan = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [
            data.diagnosis ?? existing.diagnosis,
            data.notes ?? existing.notes,
            data.treatmentPlan ?? existing.treatment_plan,
            consultationId,
        ]
    );

    return updateRes.rows[0];
}

export async function createInvestigationOrderService(
    doctorId: string,
    patientId: string,
    data: CreateInvestigationOrderInput
) {
    const patientRes = await pool.query('SELECT id FROM "Patient" WHERE id = $1', [patientId]);
    if (patientRes.rowCount === 0) {
        throw new AppError("Patient not found", 404);
    }

    const orderRes = await pool.query(
        `INSERT INTO "InvestigationOrder" (patient_id, doctor_id, test_name, instructions, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING *`,
        [patientId, doctorId, data.testName, data.instructions ?? null]
    );

    return orderRes.rows[0];
}

export async function getPatientReportsService(doctorId: string, patientId: string) {
    const patientRes = await pool.query('SELECT id FROM "Patient" WHERE id = $1', [patientId]);
    if (patientRes.rowCount === 0) {
        throw new AppError("Patient not found", 404);
    }

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
            d.name as doctor_name
         FROM "InvestigationOrder" r
         JOIN "Doctor" d ON r.doctor_id = d.id
         WHERE r.patient_id = $1
         ORDER BY r.created_at DESC`,
        [patientId]
    );

    return { reports: reportsRes.rows };
}
