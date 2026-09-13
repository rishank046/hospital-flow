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
    const result = await pool.query<DoctorListRow>(
        `INSERT INTO "Doctor" (name, email, password, specialization, department)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, specialization, department, created_at`,
        [
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
        `SELECT id, name, email, specialization, department, created_at
         FROM "Doctor"
         ORDER BY created_at DESC`
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
