import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AdminLoginInput, CreateDoctorInput } from "./admin.schema.js";

interface AdminRow {
    id: string;
    name: string;
    email: string;
    password: string;
    created_at: Date;
}

interface DoctorListRow {
    id: string;
    name: string;
    email: string;
    specialization: string;
    department: string;
    created_at: Date;
}

export async function adminLoginService(data: AdminLoginInput) {
    const result = await pool.query<AdminRow>(
        'SELECT id, name, email, password, created_at FROM "Admin" WHERE email = $1',
        [data.email]
    );

    if (result.rowCount === 0 || !result.rows[0]) {
        throw new AppError("Invalid email or password", 401);
    }

    const admin = result.rows[0];
    const passwordMatch = await bcrypt.compare(data.password, admin.password);

    if (!passwordMatch) {
        throw new AppError("Invalid email or password", 401);
    }

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

    const token = jwt.sign(
        {
            userId: admin.id,
            email: admin.email,
            role: "ADMIN",
        },
        jwtSecret,
        { expiresIn: "8h" }
    );

    return {
        token,
        admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            createdAt: admin.created_at,
        },
    };
}

export async function createDoctorService(data: CreateDoctorInput) {
    const existing = await pool.query<{ id: string }>(
        'SELECT id FROM "Doctor" WHERE email = $1',
        [data.email]
    );

    if (existing.rowCount && existing.rowCount > 0) {
        throw new AppError("Doctor with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create or find User
    let userId: string;
    const userRes = await pool.query<{ id: string }>(
        'SELECT id FROM "User" WHERE email = $1',
        [data.email]
    );

    if (userRes.rowCount && userRes.rows[0]) {
        userId = userRes.rows[0].id;
        await pool.query('UPDATE "User" SET role = $1 WHERE id = $2', ['STAFF', userId]);
    } else {
        const newUser = await pool.query<{ id: string }>(
            `INSERT INTO "User" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            [data.name, data.email, hashedPassword]
        );
        userId = newUser.rows[0]!.id;
    }

    // Create Staff record
    const employeeCode = `DOC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const staffRes = await pool.query<{ id: string }>(
        `INSERT INTO "Staff" (user_id, employee_code, role, status)
         VALUES ($1, $2, 'DOCTOR', 'ACTIVE')
         RETURNING id`,
        [userId, employeeCode]
    );
    const staffId = staffRes.rows[0]!.id;

    // Find or create Department
    let departmentId: string | null = null;
    const deptRes = await pool.query<{ id: string }>(
        'SELECT id FROM "Department" WHERE name ILIKE $1',
        [data.department.trim()]
    );
    if (deptRes.rowCount && deptRes.rows[0]) {
        departmentId = deptRes.rows[0].id;
    } else {
        const newDept = await pool.query<{ id: string }>(
            'INSERT INTO "Department" (name) VALUES ($1) RETURNING id',
            [data.department.trim()]
        );
        departmentId = newDept.rows[0]?.id ?? null;
    }

    const result = await pool.query<DoctorListRow>(
        `INSERT INTO "Doctor" (staff_id, department_id, name, email, password, specialization, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, specialization, department, created_at`,
        [
            staffId,
            departmentId,
            data.name,
            data.email,
            hashedPassword,
            data.specialization,
            data.department,
        ]
    );

    const doctor = result.rows[0];
    if (!doctor) {
        throw new AppError("Failed to create doctor", 500);
    }

    return doctor;
}

export async function listDoctorsService() {
    const result = await pool.query<DoctorListRow>(
        `SELECT 
            d.id, 
            COALESCE(u.name, d.name) as name, 
            COALESCE(u.email, d.email) as email, 
            d.specialization, 
            COALESCE(dept.name, d.department) as department, 
            d.created_at
         FROM "Doctor" d
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         ORDER BY d.created_at DESC`
    );

    return { doctors: result.rows };
}

export async function listPatientsService() {
    const result = await pool.query(
        `SELECT
            p.id,
            p.owner_user_id,
            p.name,
            p.age,
            p.gender,
            p.patient_type,
            p.doctor_id,
            p.created_at,
            u.email as owner_email
         FROM "Patient" p
         LEFT JOIN "User" u ON p.owner_user_id = u.id
         ORDER BY p.created_at DESC`
    );

    return { patients: result.rows };
}

export {
    createStaffService,
    updateStaffService,
    updateStaffStatusService,
    listStaffService,
} from "#modules/staff/staff.service.js";
