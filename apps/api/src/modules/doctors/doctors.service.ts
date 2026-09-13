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
    name?: string | null;
    email?: string | null;
    password?: string | null;
    specialization: string;
    department?: string | null;
    created_at: Date;
}

function getJwtSecret(): string {
    const jwtSecret = process.env.JWT_SECRET;
    const normalizedSecret = jwtSecret?.toLowerCase();
    if (
        !jwtSecret ||
        jwtSecret.length < 32 ||
        normalizedSecret === "default_secret" ||
        normalizedSecret === "your_jwt_secret_key_minimum_32_chars" ||
        normalizedSecret === "replace_with_a_random_64_char_secret"
    ) {
        throw new AppError("JWT secret is not configured or too weak", 500);
    }
    return jwtSecret;
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
    // 1. Check User table joined with Staff and Doctor
    const staffUserRes = await pool.query(
        `SELECT 
            u.id as user_id, 
            u.name, 
            u.email, 
            u.password, 
            s.id as staff_id,
            s.role as staff_role,
            s.status as staff_status,
            d.id as doctor_id, 
            d.specialization, 
            COALESCE(dept.name, d.department) as department,
            d.created_at
         FROM "User" u
         JOIN "Staff" s ON s.user_id = u.id
         JOIN "Doctor" d ON d.staff_id = s.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         WHERE u.email = $1`,
        [data.email]
    );

    if (staffUserRes.rowCount && staffUserRes.rows[0]) {
        const row = staffUserRes.rows[0];
        if (row.staff_status !== "ACTIVE") {
            throw new AppError("Doctor staff account is inactive", 403);
        }
        const passwordMatch = await bcrypt.compare(data.password, row.password);
        if (!passwordMatch) {
            throw new AppError("Invalid email or password", 401);
        }

        const jwtSecret = getJwtSecret();
        const token = jwt.sign(
            {
                userId: row.user_id,
                email: row.email,
                role: "STAFF",
                staffRole: "DOCTOR",
            },
            jwtSecret,
            { expiresIn: "8h" }
        );

        return {
            token,
            doctor: {
                id: row.doctor_id,
                name: row.name,
                email: row.email,
                specialization: row.specialization,
                department: row.department,
                createdAt: row.created_at,
            },
        };
    }

    // 2. Direct Doctor table fallback (for legacy seed)
    const result = await pool.query<DoctorRow>(
        'SELECT id, name, email, password, specialization, department, created_at FROM "Doctor" WHERE email = $1',
        [data.email]
    );

    const doctor = result.rows[0];
    if (!doctor || !doctor.password) {
        throw new AppError("Invalid email or password", 401);
    }

    const passwordMatch = await bcrypt.compare(data.password, doctor.password);

    if (!passwordMatch) {
        throw new AppError("Invalid email or password", 401);
    }

    const jwtSecret = getJwtSecret();
    const token = jwt.sign(
        {
            userId: doctor.id,
            email: doctor.email ?? data.email,
            role: "STAFF",
            staffRole: "DOCTOR",
        },
        jwtSecret,
        { expiresIn: "8h" }
    );

    return {
        token,
        doctor: {
            id: doctor.id,
            name: doctor.name ?? "Doctor",
            email: doctor.email ?? data.email,
            specialization: doctor.specialization,
            department: doctor.department ?? "General",
            createdAt: doctor.created_at,
        },
    };
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
