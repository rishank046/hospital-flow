import crypto from "crypto";
import bcrypt from "bcrypt";
import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import { loginService } from "#modules/auth/auth.service.js";
import type {
    AdminLoginInput,
    CreateDoctorInput,
    CreateStaffInput,
    UpdateStaffInput,
    UpdateStaffStatusInput,
} from "./admin.schema.js";

interface DoctorListRow {
    id: string;
    name: string;
    email: string;
    specialization: string;
    department: string;
    created_at: Date;
}

export async function adminLoginService(data: AdminLoginInput) {
    return loginService(data.email, data.password);
}

export async function createDoctorService(data: CreateDoctorInput) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const normalizedEmail = data.email.toLowerCase().trim();
        const existing = await client.query<{ id: string }>(
            'SELECT id FROM "Doctor" WHERE email = $1',
            [normalizedEmail]
        );

        if (existing.rowCount && existing.rowCount > 0) {
            throw new AppError("Doctor with this email already exists", 409);
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);

        // Create or find User
        let userId: string;
        const userRes = await client.query<{ id: string }>(
            'SELECT id FROM "User" WHERE email = $1',
            [normalizedEmail]
        );

        if (userRes.rowCount && userRes.rows[0]) {
            userId = userRes.rows[0].id;
            await client.query(
                'UPDATE "User" SET role = $1, is_active = true WHERE id = $2',
                ["STAFF", userId]
            );
        } else {
            const newUser = await client.query<{ id: string }>(
                `INSERT INTO "User" (name, email, password, role, is_active)
                 VALUES ($1, $2, $3, 'STAFF', true)
                 RETURNING id`,
                [data.name.trim(), normalizedEmail, hashedPassword]
            );
            userId = newUser.rows[0]!.id;
        }

        // Create Staff record
        const employeeCode = `DOC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        const staffRes = await client.query<{ id: string }>(
            `INSERT INTO "Staff" (user_id, employee_code, role, status)
             VALUES ($1, $2, 'DOCTOR', 'ACTIVE')
             RETURNING id`,
            [userId, employeeCode]
        );
        const staffId = staffRes.rows[0]!.id;

        // Find or create Department
        let departmentId: string | null = null;
        const deptRes = await client.query<{ id: string }>(
            'SELECT id FROM "Department" WHERE name ILIKE $1',
            [data.department.trim()]
        );
        if (deptRes.rowCount && deptRes.rows[0]) {
            departmentId = deptRes.rows[0].id;
        } else {
            const newDept = await client.query<{ id: string }>(
                'INSERT INTO "Department" (name) VALUES ($1) RETURNING id',
                [data.department.trim()]
            );
            departmentId = newDept.rows[0]?.id ?? null;
        }

        if (departmentId) {
            await client.query('UPDATE "Staff" SET department_id = $1 WHERE id = $2', [
                departmentId,
                staffId,
            ]);
        }

        const result = await client.query<DoctorListRow>(
            `INSERT INTO "Doctor" (staff_id, department_id, name, email, password, specialization, department)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, name, email, specialization, department, created_at`,
            [
                staffId,
                departmentId,
                data.name.trim(),
                normalizedEmail,
                hashedPassword,
                data.specialization,
                data.department.trim(),
            ]
        );

        const doctor = result.rows[0];
        if (!doctor) {
            throw new AppError("Failed to create doctor", 500);
        }

        await client.query("COMMIT");
        return doctor;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function createStaffService(data: CreateStaffInput) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const normalizedEmail = data.email.toLowerCase().trim();

        // 1. Check email uniqueness in User table
        const userCheck = await client.query<{ id: string }>(
            'SELECT id FROM "User" WHERE email = $1',
            [normalizedEmail]
        );
        if (userCheck.rowCount && userCheck.rowCount > 0) {
            throw new AppError("A user with this email already exists", 409);
        }

        // 2. Resolve employeeCode
        let employeeCode = data.employeeCode?.trim();
        if (!employeeCode) {
            const prefix = data.role.slice(0, 3).toUpperCase();
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            employeeCode = `${prefix}-${Date.now().toString().slice(-6)}-${randomNum}`;
        }

        const codeCheck = await client.query<{ id: string }>(
            'SELECT id FROM "Staff" WHERE employee_code = $1',
            [employeeCode]
        );
        if (codeCheck.rowCount && codeCheck.rowCount > 0) {
            throw new AppError("A staff member with this employee code already exists", 409);
        }

        // 3. Password handling
        const temporaryPassword =
            data.password || `Temp#${crypto.randomBytes(6).toString("hex")}`;
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        const status = data.status ?? "ACTIVE";
        const isActive = status === "ACTIVE";

        // 4. Insert into User table
        const userRes = await client.query<{
            id: string;
            name: string;
            email: string;
            role: string;
            is_active: boolean;
            created_at: Date;
        }>(
            `INSERT INTO "User" (name, email, password, role, is_active)
             VALUES ($1, $2, $3, 'STAFF', $4)
             RETURNING id, name, email, role, is_active, created_at`,
            [data.name.trim(), normalizedEmail, hashedPassword, isActive]
        );
        const userRow = userRes.rows[0];
        if (!userRow) {
            throw new AppError("Failed to create user account for staff member", 500);
        }

        // 5. Resolve Department
        let departmentId: string | null = data.departmentId ?? null;
        let departmentName: string | null = data.department?.trim() ?? null;

        if (departmentId && !departmentName) {
            const deptRes = await client.query<{ id: string; name: string }>(
                'SELECT id, name FROM "Department" WHERE id = $1',
                [departmentId]
            );
            if (deptRes.rowCount && deptRes.rows[0]) {
                departmentName = deptRes.rows[0].name;
            }
        } else if (departmentName && !departmentId) {
            const deptRes = await client.query<{ id: string; name: string }>(
                'SELECT id, name FROM "Department" WHERE name ILIKE $1',
                [departmentName]
            );
            if (deptRes.rowCount && deptRes.rows[0]) {
                departmentId = deptRes.rows[0].id;
                departmentName = deptRes.rows[0].name;
            } else {
                const newDept = await client.query<{ id: string; name: string }>(
                    'INSERT INTO "Department" (name) VALUES ($1) RETURNING id, name',
                    [departmentName]
                );
                if (newDept.rows[0]) {
                    departmentId = newDept.rows[0].id;
                    departmentName = newDept.rows[0].name;
                }
            }
        }

        // 6. Insert into Staff table
        const staffRes = await client.query<{
            id: string;
            user_id: string;
            employee_code: string;
            role: string;
            status: string;
            department_id: string | null;
            created_at: Date;
        }>(
            `INSERT INTO "Staff" (user_id, employee_code, role, status, department_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, user_id, employee_code, role, status, department_id, created_at`,
            [userRow.id, employeeCode, data.role, status, departmentId]
        );
        const staffRow = staffRes.rows[0];
        if (!staffRow) {
            throw new AppError("Failed to create staff record", 500);
        }

        // 7. If role = DOCTOR, create Doctor record
        let doctorRecord: unknown = null;
        if (data.role === "DOCTOR") {
            const specialization = data.specialization ?? "Cardiology";
            const docRes = await client.query(
                `INSERT INTO "Doctor" (staff_id, department_id, specialization, department, name, email, license_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, staff_id, department_id, specialization, department, license_number, created_at`,
                [
                    staffRow.id,
                    departmentId,
                    specialization,
                    departmentName ?? "General",
                    data.name.trim(),
                    normalizedEmail,
                    data.licenseNumber ?? null,
                ]
            );
            doctorRecord = docRes.rows[0] ?? null;
        }

        await client.query("COMMIT");

        return {
            staff: {
                id: staffRow.id,
                userId: staffRow.user_id,
                user_id: staffRow.user_id,
                employeeCode: staffRow.employee_code,
                employee_code: staffRow.employee_code,
                role: staffRow.role,
                status: staffRow.status,
                departmentId: staffRow.department_id,
                department_id: staffRow.department_id,
                createdAt: staffRow.created_at,
                created_at: staffRow.created_at,
            },
            user: {
                id: userRow.id,
                name: userRow.name,
                email: userRow.email,
                role: userRow.role,
                isActive: userRow.is_active,
                is_active: userRow.is_active,
            },
            temporaryPassword,
            ...(doctorRecord ? { doctor: doctorRecord } : {}),
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function updateStaffStatusService(staffId: string, data: UpdateStaffStatusInput) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query<{ id: string; user_id: string }>(
            'SELECT id, user_id FROM "Staff" WHERE id = $1',
            [staffId]
        );

        if (existing.rowCount === 0 || !existing.rows[0]) {
            throw new AppError("Staff member not found", 404);
        }

        const userId = existing.rows[0].user_id;

        const updateRes = await client.query<{
            id: string;
            user_id: string;
            employee_code: string;
            role: string;
            status: string;
            department_id: string | null;
            created_at: Date;
        }>(
            `UPDATE "Staff"
             SET status = $1
             WHERE id = $2
             RETURNING id, user_id, employee_code, role, status, department_id, created_at`,
            [data.status, staffId]
        );

        if (data.status === "INACTIVE" || data.status === "ACTIVE") {
            const isActive = data.status === "ACTIVE";
            await client.query(
                'UPDATE "User" SET is_active = $1 WHERE id = $2',
                [isActive, userId]
            );
        }

        await client.query("COMMIT");

        const row = updateRes.rows[0]!;
        return {
            ...row,
            employeeCode: row.employee_code,
            userId: row.user_id,
            departmentId: row.department_id,
            createdAt: row.created_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function updateStaffService(staffId: string, data: UpdateStaffInput) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query<{
            id: string;
            user_id: string;
            employee_code: string;
            role: string;
            status: string;
            department_id: string | null;
        }>(
            'SELECT id, user_id, employee_code, role, status, department_id FROM "Staff" WHERE id = $1',
            [staffId]
        );

        if (existing.rowCount === 0 || !existing.rows[0]) {
            throw new AppError("Staff member not found", 404);
        }

        const current = existing.rows[0];
        const userId = current.user_id;

        if (data.email) {
            const emailCheck = await client.query<{ id: string }>(
                'SELECT id FROM "User" WHERE email = $1 AND id != $2',
                [data.email.toLowerCase().trim(), userId]
            );
            if (emailCheck.rowCount && emailCheck.rowCount > 0) {
                throw new AppError("Email already in use", 409);
            }
            await client.query(
                'UPDATE "User" SET email = $1 WHERE id = $2',
                [data.email.toLowerCase().trim(), userId]
            );
        }

        if (data.name) {
            await client.query(
                'UPDATE "User" SET name = $1 WHERE id = $2',
                [data.name.trim(), userId]
            );
        }

        if (data.status) {
            if (data.status === "INACTIVE" || data.status === "ACTIVE") {
                await client.query(
                    'UPDATE "User" SET is_active = $1 WHERE id = $2',
                    [data.status === "ACTIVE", userId]
                );
            }
        }

        if (data.employeeCode && data.employeeCode !== current.employee_code) {
            const codeCheck = await client.query<{ id: string }>(
                'SELECT id FROM "Staff" WHERE employee_code = $1 AND id != $2',
                [data.employeeCode.trim(), staffId]
            );
            if (codeCheck.rowCount && codeCheck.rowCount > 0) {
                throw new AppError("A staff member with this employee code already exists", 409);
            }
        }

        let resolvedDeptId = current.department_id;
        let resolvedDeptName: string | null = data.department?.trim() ?? null;

        if (data.departmentId !== undefined) {
            resolvedDeptId = data.departmentId;
        } else if (resolvedDeptName) {
            const deptRes = await client.query<{ id: string; name: string }>(
                'SELECT id, name FROM "Department" WHERE name ILIKE $1',
                [resolvedDeptName]
            );
            if (deptRes.rowCount && deptRes.rows[0]) {
                resolvedDeptId = deptRes.rows[0].id;
                resolvedDeptName = deptRes.rows[0].name;
            } else {
                const newDept = await client.query<{ id: string; name: string }>(
                    'INSERT INTO "Department" (name) VALUES ($1) RETURNING id, name',
                    [resolvedDeptName]
                );
                resolvedDeptId = newDept.rows[0]?.id ?? null;
                resolvedDeptName = newDept.rows[0]?.name ?? null;
            }
        }

        const updateRes = await client.query<{
            id: string;
            user_id: string;
            employee_code: string;
            role: string;
            status: string;
            department_id: string | null;
            created_at: Date;
        }>(
            `UPDATE "Staff"
             SET employee_code = $1,
                 role = $2,
                 status = $3,
                 department_id = $4
             WHERE id = $5
             RETURNING id, user_id, employee_code, role, status, department_id, created_at`,
            [
                data.employeeCode ?? current.employee_code,
                data.role ?? current.role,
                data.status ?? current.status,
                resolvedDeptId,
                staffId,
            ]
        );

        if (data.department || data.name || data.email || resolvedDeptId) {
            await client.query(
                `UPDATE "Doctor"
                 SET department_id = COALESCE($1, department_id),
                     department = COALESCE($2, department),
                     name = COALESCE($3, name),
                     email = COALESCE($4, email)
                 WHERE staff_id = $5`,
                [
                    resolvedDeptId,
                    resolvedDeptName,
                    data.name?.trim() ?? null,
                    data.email?.toLowerCase().trim() ?? null,
                    staffId,
                ]
            );
        }

        await client.query("COMMIT");

        const row = updateRes.rows[0]!;
        return {
            ...row,
            employeeCode: row.employee_code,
            userId: row.user_id,
            departmentId: row.department_id,
            createdAt: row.created_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function listStaffService() {
    const result = await pool.query(
        `SELECT 
            s.id as staff_id,
            s.id,
            s.user_id,
            s.employee_code,
            s.role as staff_role,
            s.role,
            s.status as staff_status,
            s.status,
            s.department_id,
            s.created_at,
            u.name,
            u.email,
            u.is_active,
            d.id as doctor_id,
            d.specialization,
            COALESCE(dept.name, s_dept.name, d.department) as department
         FROM "Staff" s
         JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Doctor" d ON d.staff_id = s.id
         LEFT JOIN "Department" dept ON d.department_id = dept.id
         LEFT JOIN "Department" s_dept ON s.department_id = s_dept.id
         ORDER BY s.created_at DESC`
    );

    return { staff: result.rows };
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

