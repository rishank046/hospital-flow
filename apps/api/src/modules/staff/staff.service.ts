import bcrypt from "bcrypt";
import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { CreateStaffInput, UpdateStaffInput, UpdateStaffStatusInput } from "./staff.schema.js";

export async function getStaffProfileService(userId: string) {
    const result = await pool.query(
        `SELECT 
            s.id as staff_id,
            s.user_id,
            s.employee_code,
            s.role as staff_role,
            s.status as staff_status,
            s.created_at,
            u.name,
            u.email,
            u.role as system_role,
            d.id as doctor_id,
            d.specialization,
            d.license_number,
            COALESCE(dept.name, d.department) as department
         FROM "Staff" s
         JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Doctor" d ON d.staff_id = s.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         WHERE s.user_id = $1`,
        [userId]
    );

    if (result.rowCount === 0 || !result.rows[0]) {
        throw new AppError("Staff profile not found", 404);
    }

    return result.rows[0];
}

export async function getStaffByIdService(staffId: string) {
    const result = await pool.query(
        `SELECT 
            s.id as staff_id,
            s.user_id,
            s.employee_code,
            s.role as staff_role,
            s.status as staff_status,
            s.created_at,
            u.name,
            u.email,
            u.role as system_role,
            d.id as doctor_id,
            d.specialization,
            d.license_number,
            COALESCE(dept.name, d.department) as department
         FROM "Staff" s
         JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Doctor" d ON d.staff_id = s.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         WHERE s.id = $1`,
        [staffId]
    );

    if (result.rowCount === 0 || !result.rows[0]) {
        throw new AppError("Staff member not found", 404);
    }

    return result.rows[0];
}

export async function createStaffService(data: CreateStaffInput) {
    // Check if employee_code is already taken
    const codeCheck = await pool.query<{ id: string }>(
        'SELECT id FROM "Staff" WHERE employee_code = $1',
        [data.employeeCode]
    );
    if (codeCheck.rowCount && codeCheck.rowCount > 0) {
        throw new AppError("A staff member with this employee code already exists", 409);
    }

    // Check if user with this email exists
    let userId: string;
    const userCheck = await pool.query<{ id: string; password: string }>(
        'SELECT id, password FROM "User" WHERE email = $1',
        [data.email]
    );

    if (userCheck.rowCount && userCheck.rows[0]) {
        userId = userCheck.rows[0].id;
        await pool.query('UPDATE "User" SET role = $1 WHERE id = $2', [
            "STAFF",
            userId,
        ]);
    } else {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const newUser = await pool.query<{ id: string }>(
            `INSERT INTO "User" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            [data.name, data.email, hashedPassword]
        );
        if (!newUser.rows[0]) {
            throw new AppError("Failed to create user account for staff member", 500);
        }
        userId = newUser.rows[0].id;
    }

    // Check if staff record already exists for this user
    const existingStaff = await pool.query<{ id: string }>(
        'SELECT id FROM "Staff" WHERE user_id = $1',
        [userId]
    );
    if (existingStaff.rowCount && existingStaff.rowCount > 0) {
        throw new AppError("This user is already a hospital staff member", 409);
    }

    // Insert staff
    const staffRes = await pool.query<{ id: string }>(
        `INSERT INTO "Staff" (user_id, employee_code, role, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, employee_code, role, status, created_at`,
        [userId, data.employeeCode, data.role, data.status ?? "ACTIVE"]
    );

    const staff = staffRes.rows[0];
    if (!staff) {
        throw new AppError("Failed to create staff record", 500);
    }

    let doctorRecord: unknown = null;
    // If staff role is DOCTOR, create Doctor record
    if (data.role === "DOCTOR") {
        let departmentId: string | null = null;
        if (data.department) {
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
        }

        const specialization = data.specialization ?? "Cardiology";
        const docRes = await pool.query(
            `INSERT INTO "Doctor" (staff_id, department_id, specialization, department, name, email, license_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, staff_id, department_id, specialization, department, license_number, created_at`,
            [
                staff.id,
                departmentId,
                specialization,
                data.department ?? "General",
                data.name,
                data.email,
                data.licenseNumber ?? null,
            ]
        );
        doctorRecord = docRes.rows[0];
    }

    return {
        staff,
        doctor: doctorRecord,
        user: {
            id: userId,
            name: data.name,
            email: data.email,
        },
    };
}

export async function updateStaffService(staffId: string, data: UpdateStaffInput) {
    const existing = await pool.query<{ id: string; employee_code: string; role: string; status: string }>(
        'SELECT id, employee_code, role, status FROM "Staff" WHERE id = $1',
        [staffId]
    );

    if (existing.rowCount === 0 || !existing.rows[0]) {
        throw new AppError("Staff member not found", 404);
    }

    const current = existing.rows[0];
    const updateRes = await pool.query(
        `UPDATE "Staff"
         SET employee_code = $1,
             role = $2,
             status = $3
         WHERE id = $4
         RETURNING id, user_id, employee_code, role, status, created_at`,
        [
            data.employeeCode ?? current.employee_code,
            data.role ?? current.role,
            data.status ?? current.status,
            staffId,
        ]
    );

    return updateRes.rows[0];
}

export async function updateStaffStatusService(staffId: string, data: UpdateStaffStatusInput) {
    const updateRes = await pool.query(
        `UPDATE "Staff"
         SET status = $1
         WHERE id = $2
         RETURNING id, user_id, employee_code, role, status, created_at`,
        [data.status, staffId]
    );

    if (updateRes.rowCount === 0 || !updateRes.rows[0]) {
        throw new AppError("Staff member not found", 404);
    }

    return updateRes.rows[0];
}

export async function listStaffService() {
    const result = await pool.query(
        `SELECT 
            s.id as staff_id,
            s.user_id,
            s.employee_code,
            s.role as staff_role,
            s.status as staff_status,
            s.created_at,
            u.name,
            u.email,
            d.id as doctor_id,
            d.specialization,
            COALESCE(dept.name, d.department) as department
         FROM "Staff" s
         JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Doctor" d ON d.staff_id = s.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         ORDER BY s.created_at DESC`
    );

    return { staff: result.rows };
}
