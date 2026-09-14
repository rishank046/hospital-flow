import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import { loginService } from "#modules/auth/auth.service.js";
import type {
    DoctorLoginInput,
    UpdateDoctorProfileInput,
} from "./doctor.schema.js";

export async function resolveDoctorId(userIdOrDoctorId: string): Promise<string> {
    // 1. Check if matches Staff -> Doctor
    const staffDocRes = await pool.query<{ id: string }>(
        `SELECT d.id 
         FROM "doctors" d
         JOIN "staff_profiles" s ON d.staff_id = s.id
         WHERE s.user_id = $1`,
        [userIdOrDoctorId]
    );

    if (staffDocRes.rowCount && staffDocRes.rows[0]) {
        return staffDocRes.rows[0].id;
    }

    // 2. Direct match on Doctor id
    const directDocRes = await pool.query<{ id: string }>(
        'SELECT id FROM "doctors" WHERE id = $1',
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
            u.name, 
            u.email, 
            d.specialization, 
            dept.name as department, 
            d.license_number,
            d.consultation_minutes,
            d.created_at
         FROM "doctors" d
         JOIN "staff_profiles" s ON d.staff_id = s.id
         JOIN "users" u ON s.user_id = u.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
         ORDER BY d.created_at DESC`
    );

    return { doctors: result.rows };
}

export async function getDoctorProfileService(doctorId: string) {
    const result = await pool.query(
        `SELECT 
            d.id, 
            u.name, 
            u.email, 
            d.specialization, 
            dept.name as department, 
            d.license_number,
            d.staff_id,
            d.consultation_minutes,
            d.created_at
         FROM "doctors" d
         JOIN "staff_profiles" s ON d.staff_id = s.id
         JOIN "users" u ON s.user_id = u.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
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
        `SELECT d.id, d.staff_id, d.specialization, s.user_id, s.department_id 
         FROM "doctors" d
         JOIN "staff_profiles" s ON d.staff_id = s.id
         WHERE d.id = $1`,
        [doctorId]
    );

    if (existing.rowCount === 0 || !existing.rows[0]) {
        throw new AppError("Doctor not found", 404);
    }

    const current = existing.rows[0];

    // If name is provided and user is linked, update users table
    if (data.name && current.user_id) {
        await pool.query('UPDATE "users" SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
            data.name,
            current.user_id,
        ]);
    }

    // Update doctors specialization
    if (data.specialization) {
        await pool.query(
            `UPDATE "doctors"
             SET specialization = $1
             WHERE id = $2`,
            [data.specialization, doctorId]
        );
    }

    // If department is provided, update staff_profiles.department_id
    if (data.department) {
        const deptRes = await pool.query<{ id: string }>(
            'SELECT id FROM "departments" WHERE name ILIKE $1',
            [data.department.trim()]
        );
        let deptId = deptRes.rows[0]?.id;
        if (!deptId) {
            const newDept = await pool.query<{ id: string }>(
                'INSERT INTO "departments" (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                [data.department.trim()]
            );
            deptId = newDept.rows[0]?.id;
        }
        if (deptId && current.staff_id) {
            await pool.query(
                'UPDATE "staff_profiles" SET department_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [deptId, current.staff_id]
            );
        }
    }

    return getDoctorProfileService(doctorId);
}

export async function getDoctorScheduleService(doctorId: string) {
    const scheduleRes = await pool.query(
        `SELECT 
            a.id,
            a.start_time,
            a.end_time,
            a.type,
            a.status,
            a.created_at,
            p.id as patient_id,
            p.name as patient_name,
            EXTRACT(YEAR FROM age(p.date_of_birth))::int as patient_age,
            p.gender as patient_gender,
            'Online' as patient_type
         FROM "appointments" a
         JOIN "patient_profiles" p ON a.patient_id = p.id
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
            EXTRACT(YEAR FROM age(p.date_of_birth))::int as age,
            p.gender,
            'Online' as patient_type,
            p.created_at,
            u.email as owner_email
         FROM "patient_profiles" p
         LEFT JOIN "users" u ON p.user_id = u.id
         LEFT JOIN "appointments" a ON a.patient_id = p.id
         LEFT JOIN "visits" v ON v.patient_id = p.id
         LEFT JOIN "consultations" c ON c.visit_id = v.id
         WHERE a.doctor_id = $1 OR v.assigned_doctor_id = $1 OR c.doctor_id = $1
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
            EXTRACT(YEAR FROM age(p.date_of_birth))::int as age,
            p.gender,
            'Online' as patient_type,
            p.created_at,
            u.email as owner_email
         FROM "patient_profiles" p
         LEFT JOIN "users" u ON p.user_id = u.id
         WHERE p.id = $1`,
        [patientId]
    );

    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient not found", 404);
    }

    const patient = patientRes.rows[0];

    const appointmentsRes = await pool.query(
        `SELECT id, start_time, end_time, type, status, created_at
         FROM "appointments"
         WHERE patient_id = $1 AND doctor_id = $2
         ORDER BY start_time DESC`,
        [patientId, doctorId]
    );

    const consultationsRes = await pool.query(
        `SELECT c.id, c.diagnosis, c.notes, c.treatment_plan, c.created_at, c.updated_at
         FROM "consultations" c
         JOIN "visits" v ON c.visit_id = v.id
         WHERE v.patient_id = $1 AND c.doctor_id = $2
         ORDER BY c.created_at DESC`,
        [patientId, doctorId]
    );

    const prescriptionsRes = await pool.query(
        `SELECT pr.id, pr.consultation_id, pr.medication, pr.dosage, pr.frequency, pr.duration, pr.instructions, pr.status, pr.created_at
         FROM "prescriptions" pr
         JOIN "visits" v ON pr.visit_id = v.id
         WHERE v.patient_id = $1 AND pr.doctor_id = $2
         ORDER BY pr.created_at DESC`,
        [patientId, doctorId]
    );

    const reportsRes = await pool.query(
        `SELECT io.id, io.test_name, io.instructions, io.status, io.result, io.created_at, io.updated_at
         FROM "investigation_orders" io
         JOIN "visits" v ON io.visit_id = v.id
         WHERE v.patient_id = $1 AND io.doctor_id = $2
         ORDER BY io.created_at DESC`,
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
    createLabOrderService as createInvestigationOrderService,
    createLabOrderService,
    getPatientReportsService,
} from "#modules/lab-orders/lab-orders.service.js";
