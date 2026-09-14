import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import { loginService } from "#modules/auth/auth.service.js";
import type {
    CreateConsultationInput,
    CreateInvestigationOrderInput,
    DoctorLoginInput,
    UpdateConsultationInput,
    UpdateDoctorProfileInput,
} from "./doctor.schema.js";

interface DoctorRow {
    id: string;
    name?: string | null;
    email?: string | null;
    password?: string | null;
    specialization: string;
    department?: string | null;
    created_at: Date;
}

export async function resolveDoctorId(userIdOrDoctorId: string): Promise<string> {
    // 1. Check if matches Staff -> Doctor
    const staffDocRes = await pool.query<{ id: string }>(
        `SELECT d.id 
         FROM "Doctor" d
         JOIN "Staff" s ON d.staff_id = s.id
         WHERE s.user_id = $1`,
        [userIdOrDoctorId]
    );

    if (staffDocRes.rowCount && staffDocRes.rows[0]) {
        return staffDocRes.rows[0].id;
    }

    // 2. Direct match on Doctor id (for legacy/test setups)
    const directDocRes = await pool.query<{ id: string }>(
        'SELECT id FROM "Doctor" WHERE id = $1',
        [userIdOrDoctorId]
    );

    if (directDocRes.rowCount && directDocRes.rows[0]) {
        return directDocRes.rows[0].id;
    }

    throw new AppError("Doctor profile not found for this authenticated account", 404);
}

export async function doctorLoginService(data: DoctorLoginInput) {
    return loginService(data.email, data.password);
}


export async function listPublicDoctorsService() {
    const result = await pool.query(
        `SELECT 
            d.id, 
            COALESCE(u.name, d.name) as name, 
            COALESCE(u.email, d.email) as email, 
            d.specialization, 
            COALESCE(dept.name, d.department) as department, 
            d.license_number,
            d.created_at
         FROM "Doctor" d
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         ORDER BY d.created_at DESC`
    );

    return { doctors: result.rows };
}

export async function getDoctorProfileService(doctorId: string) {
    const result = await pool.query(
        `SELECT 
            d.id, 
            COALESCE(u.name, d.name) as name, 
            COALESCE(u.email, d.email) as email, 
            d.specialization, 
            COALESCE(dept.name, d.department) as department, 
            d.license_number,
            d.staff_id,
            d.created_at
         FROM "Doctor" d
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         WHERE d.id = $1`,
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
    const existing = await pool.query(
        `SELECT d.id, d.staff_id, d.specialization, d.department, s.user_id 
         FROM "Doctor" d
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         WHERE d.id = $1`,
        [doctorId]
    );

    if (existing.rowCount === 0 || !existing.rows[0]) {
        throw new AppError("Doctor not found", 404);
    }

    const current = existing.rows[0];

    // If name is provided and user is linked, update User table
    if (data.name && current.user_id) {
        await pool.query('UPDATE "User" SET name = $1 WHERE id = $2', [
            data.name,
            current.user_id,
        ]);
    }

    // Update Doctor table
    await pool.query(
        `UPDATE "Doctor"
         SET name = COALESCE($1, name),
             specialization = COALESCE($2, specialization),
             department = COALESCE($3, department)
         WHERE id = $4`,
        [
            data.name ?? null,
            data.specialization ?? null,
            data.department ?? null,
            doctorId,
        ]
    );

    return getDoctorProfileService(doctorId);
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

export {
    createConsultationService,
    updateConsultationService,
} from "#modules/consultations/consultations.service.js";

export {
    createInvestigationOrderService,
    getPatientReportsService,
} from "#modules/lab-orders/lab-orders.service.js";
