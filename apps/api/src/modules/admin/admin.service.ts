import crypto from "crypto";
import bcrypt from "bcrypt";
import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import { loginService } from "#modules/auth/auth.service.js";
import type {
    AdminLoginInput,
    CreateDoctorAdminInput,
    CreateStaffInput,
    UpdateStaffInput,
    UpdateStaffStatusInput,
} from "./admin.schema.js";

export async function adminLoginService(data: AdminLoginInput) {
    return loginService(data.email, data.password);
}

interface DoctorListRow {
    id: string;
    staff_id?: string;
    name: string;
    email: string;
    specialization: string;
    department?: string | null;
    license_number?: string | null;
    status?: string;
    employee_code?: string;
    created_at: Date;
}

export async function createDoctorService(data: CreateDoctorAdminInput) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const normalizedEmail = data.email.toLowerCase().trim();
        const existing = await client.query<{ id: string }>(
            'SELECT id FROM "users" WHERE email = $1',
            [normalizedEmail]
        );

        if (existing.rowCount && existing.rowCount > 0) {
            throw new AppError("Doctor with this email already exists", 409);
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);

        // 1. Create User
        const newUser = await client.query<{ id: string }>(
            `INSERT INTO "users" (name, email, password, role, is_active)
             VALUES ($1, $2, $3, 'STAFF', true)
             RETURNING id`,
            [data.name.trim(), normalizedEmail, hashedPassword]
        );
        const userId = newUser.rows[0]!.id;

        // 2. Find or create Department
        let departmentId: string | null = null;
        const deptRes = await client.query<{ id: string }>(
            'SELECT id FROM "departments" WHERE name ILIKE $1',
            [data.department.trim()]
        );
        if (deptRes.rowCount && deptRes.rows[0]) {
            departmentId = deptRes.rows[0].id;
        } else {
            const newDept = await client.query<{ id: string }>(
                'INSERT INTO "departments" (name) VALUES ($1) RETURNING id',
                [data.department.trim()]
            );
            departmentId = newDept.rows[0]?.id ?? null;
        }

        // 3. Create Staff record
        const employeeCode = `DOC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const staffRes = await client.query<{ id: string }>(
            `INSERT INTO "staff_profiles" (user_id, employee_code, staff_role, status, department_id)
             VALUES ($1, $2, 'DOCTOR', 'ACTIVE', $3)
             RETURNING id`,
            [userId, employeeCode, departmentId]
        );
        const staffId = staffRes.rows[0]!.id;

        // 4. Create Doctor record
        const docResult = await client.query(
            `INSERT INTO "doctors" (staff_id, specialization, license_number)
             VALUES ($1, $2, $3)
             RETURNING id, staff_id, specialization, license_number, created_at`,
            [staffId, data.specialization, null]
        );

        const doctorRow = docResult.rows[0];
        if (!doctorRow) {
            throw new AppError("Failed to create doctor", 500);
        }

        await client.query("COMMIT");

        return {
            id: doctorRow.id,
            name: data.name.trim(),
            email: normalizedEmail,
            specialization: doctorRow.specialization,
            department: data.department.trim(),
            created_at: doctorRow.created_at,
        };
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

        // 1. Check email uniqueness in users table
        const userCheck = await client.query<{ id: string }>(
            'SELECT id FROM "users" WHERE email = $1',
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
            'SELECT id FROM "staff_profiles" WHERE employee_code = $1',
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

        // 4. Insert into users table
        const userRes = await client.query<{
            id: string;
            name: string;
            email: string;
            role: string;
            is_active: boolean;
            created_at: Date;
        }>(
            `INSERT INTO "users" (name, email, password, role, is_active)
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
                'SELECT id, name FROM "departments" WHERE id = $1',
                [departmentId]
            );
            if (deptRes.rowCount && deptRes.rows[0]) {
                departmentName = deptRes.rows[0].name;
            }
        } else if (departmentName && !departmentId) {
            const deptRes = await client.query<{ id: string; name: string }>(
                'SELECT id, name FROM "departments" WHERE name ILIKE $1',
                [departmentName]
            );
            if (deptRes.rowCount && deptRes.rows[0]) {
                departmentId = deptRes.rows[0].id;
                departmentName = deptRes.rows[0].name;
            } else {
                const newDept = await client.query<{ id: string; name: string }>(
                    'INSERT INTO "departments" (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
                    [departmentName]
                );
                if (newDept.rows[0]) {
                    departmentId = newDept.rows[0].id;
                    departmentName = newDept.rows[0].name;
                }
            }
        }

        // 6. Insert into staff_profiles table
        const staffRes = await client.query<{
            id: string;
            user_id: string;
            employee_code: string;
            staff_role: string;
            status: string;
            department_id: string | null;
            created_at: Date;
        }>(
            `INSERT INTO "staff_profiles" (user_id, employee_code, staff_role, status, department_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, user_id, employee_code, staff_role, status, department_id, created_at`,
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
                `INSERT INTO "doctors" (staff_id, specialization, license_number)
                 VALUES ($1, $2, $3)
                 RETURNING id, staff_id, specialization, license_number, created_at`,
                [
                    staffRow.id,
                    specialization,
                    data.licenseNumber ?? null,
                ]
            );
            doctorRecord = {
                ...(docRes.rows[0] ?? {}),
                department: departmentName,
            };
        }
        await client.query("COMMIT");

        return {
            staff: {
                id: staffRow.id,
                userId: staffRow.user_id,
                user_id: staffRow.user_id,
                employeeCode: staffRow.employee_code,
                employee_code: staffRow.employee_code,
                role: staffRow.staff_role,
                staff_role: staffRow.staff_role,
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
            doctor: doctorRecord,
            temporaryPassword,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function updateStaffStatusService(
    staffId: string,
    data: UpdateStaffStatusInput
) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Fetch current staff row
        const existing = await client.query<{
            id: string;
            user_id: string;
            status: string;
            staff_role: string;
            employee_code: string;
        }>(
            'SELECT id, user_id, status, staff_role, employee_code FROM "staff_profiles" WHERE id = $1',
            [staffId]
        );

        if (existing.rowCount === 0 || !existing.rows[0]) {
            throw new AppError("Staff member not found", 404);
        }

        const currentStaff = existing.rows[0];

        // 2. Update staff_profiles status
        const updatedStaffRes = await client.query<{
            id: string;
            user_id: string;
            employee_code: string;
            staff_role: string;
            status: string;
            department_id: string | null;
            created_at: Date;
        }>(
            `UPDATE "staff_profiles"
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, user_id, employee_code, staff_role, status, department_id, created_at`,
            [data.status, staffId]
        );
        const updatedStaff = updatedStaffRes.rows[0]!;

        // 3. If transitioning to INACTIVE, set users.is_active = false
        if (data.status === "INACTIVE") {
            await client.query(
                'UPDATE "users" SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [currentStaff.user_id]
            );
        } else if (data.status === "ACTIVE") {
            await client.query(
                'UPDATE "users" SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [currentStaff.user_id]
            );
        }

        // Fetch user info
        const userRes = await client.query<{
            id: string;
            name: string;
            email: string;
            role: string;
            is_active: boolean;
        }>(
            'SELECT id, name, email, role, is_active FROM "users" WHERE id = $1',
            [currentStaff.user_id]
        );
        const userRow = userRes.rows[0];

        await client.query("COMMIT");

        return {
            id: updatedStaff.id,
            userId: updatedStaff.user_id,
            employeeCode: updatedStaff.employee_code,
            role: updatedStaff.staff_role,
            status: updatedStaff.status,
            departmentId: updatedStaff.department_id,
            createdAt: updatedStaff.created_at,
            staff: {
                id: updatedStaff.id,
                userId: updatedStaff.user_id,
                employeeCode: updatedStaff.employee_code,
                role: updatedStaff.staff_role,
                status: updatedStaff.status,
                departmentId: updatedStaff.department_id,
                createdAt: updatedStaff.created_at,
            },
            user: userRow
                ? {
                      id: userRow.id,
                      name: userRow.name,
                      email: userRow.email,
                      role: userRow.role,
                      isActive: userRow.is_active,
                  }
                : null,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function updateStaffService(
    staffId: string,
    data: UpdateStaffInput
) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query<{
            id: string;
            user_id: string;
            status: string;
            staff_role: string;
            employee_code: string;
            department_id: string | null;
        }>(
            'SELECT id, user_id, status, staff_role, employee_code, department_id FROM "staff_profiles" WHERE id = $1',
            [staffId]
        );

        if (existing.rowCount === 0 || !existing.rows[0]) {
            throw new AppError("Staff member not found", 404);
        }

        const currentStaff = existing.rows[0];

        if (data.email) {
            const normalizedEmail = data.email.toLowerCase().trim();
            const emailCheck = await client.query<{ id: string }>(
                'SELECT id FROM "users" WHERE email = $1 AND id != $2',
                [normalizedEmail, currentStaff.user_id]
            );
            if (emailCheck.rowCount && emailCheck.rowCount > 0) {
                throw new AppError("A user with this email already exists", 409);
            }
            await client.query(
                'UPDATE "users" SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [normalizedEmail, currentStaff.user_id]
            );
        }

        if (data.name) {
            await client.query(
                'UPDATE "users" SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [data.name.trim(), currentStaff.user_id]
            );
        }

        if (data.status) {
            if (data.status === "INACTIVE") {
                await client.query(
                    'UPDATE "users" SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [currentStaff.user_id]
                );
            } else if (data.status === "ACTIVE") {
                await client.query(
                    'UPDATE "users" SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [currentStaff.user_id]
                );
            }
        }

        // Resolve Department
        let newDepartmentId = currentStaff.department_id;
        if (data.departmentId !== undefined) {
            newDepartmentId = data.departmentId;
        } else if (data.department) {
            const deptRes = await client.query<{ id: string }>(
                'SELECT id FROM "departments" WHERE name ILIKE $1',
                [data.department.trim()]
            );
            if (deptRes.rowCount && deptRes.rows[0]) {
                newDepartmentId = deptRes.rows[0].id;
            } else {
                const createdDept = await client.query<{ id: string }>(
                    'INSERT INTO "departments" (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                    [data.department.trim()]
                );
                newDepartmentId = createdDept.rows[0]?.id ?? null;
            }
        }

        const newRole = data.role ?? currentStaff.staff_role;
        const newStatus = data.status ?? currentStaff.status;

        const updatedStaffRes = await client.query<{
            id: string;
            user_id: string;
            employee_code: string;
            staff_role: string;
            status: string;
            department_id: string | null;
            created_at: Date;
        }>(
            `UPDATE "staff_profiles"
             SET staff_role = $1,
                 status = $2,
                 department_id = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id, user_id, employee_code, staff_role, status, department_id, created_at`,
            [newRole, newStatus, newDepartmentId, staffId]
        );
        const updatedStaff = updatedStaffRes.rows[0]!;

        // Update Doctor if specialization changed
        if (updatedStaff.staff_role === "DOCTOR" && data.specialization) {
            await client.query(
                `UPDATE "doctors"
                 SET specialization = $1
                 WHERE staff_id = $2`,
                [data.specialization, staffId]
            );
        }

        const userRes = await client.query<{
            id: string;
            name: string;
            email: string;
            role: string;
            is_active: boolean;
        }>(
            'SELECT id, name, email, role, is_active FROM "users" WHERE id = $1',
            [currentStaff.user_id]
        );
        const userRow = userRes.rows[0];

        // Fetch department name
        let departmentName: string | null = null;
        if (updatedStaff.department_id) {
            const dRes = await client.query<{ name: string }>(
                'SELECT name FROM "departments" WHERE id = $1',
                [updatedStaff.department_id]
            );
            departmentName = dRes.rows[0]?.name ?? null;
        }

        await client.query("COMMIT");

        return {
            id: updatedStaff.id,
            userId: updatedStaff.user_id,
            employeeCode: updatedStaff.employee_code,
            role: updatedStaff.staff_role,
            status: updatedStaff.status,
            departmentId: updatedStaff.department_id,
            department: departmentName,
            createdAt: updatedStaff.created_at,
            staff: {
                id: updatedStaff.id,
                userId: updatedStaff.user_id,
                employeeCode: updatedStaff.employee_code,
                role: updatedStaff.staff_role,
                status: updatedStaff.status,
                departmentId: updatedStaff.department_id,
                department: departmentName,
                createdAt: updatedStaff.created_at,
            },
            user: userRow
                ? {
                      id: userRow.id,
                      name: userRow.name,
                      email: userRow.email,
                      role: userRow.role,
                      isActive: userRow.is_active,
                  }
                : null,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function listStaffService(role?: string, status?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (role) {
        params.push(role);
        conditions.push(`s.staff_role = $${params.length}`);
    }

    if (status) {
        params.push(status);
        conditions.push(`s.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            s.id,
            s.id as "staffId",
            s.user_id,
            s.user_id as "userId",
            u.name,
            u.email,
            s.employee_code,
            s.employee_code as "employeeCode",
            s.staff_role as role,
            s.staff_role as "staffRole",
            s.status,
            s.department_id,
            s.department_id as "departmentId",
            dept.name as department,
            dept.name as "departmentName",
            d.id as doctor_id,
            d.id as "doctorId",
            d.specialization,
            d.license_number,
            d.license_number as "licenseNumber",
            u.is_active,
            u.is_active as "isActive",
            s.created_at,
            s.created_at as "createdAt"
        FROM "staff_profiles" s
        JOIN "users" u ON s.user_id = u.id
        LEFT JOIN "departments" dept ON s.department_id = dept.id
        LEFT JOIN "doctors" d ON d.staff_id = s.id
        ${whereClause}
        ORDER BY s.created_at DESC
    `;

    const result = await pool.query(query, params);
    return { staff: result.rows };
}

export async function listDoctorsService() {
    const query = `
        SELECT 
            d.id,
            d.id as "doctorId",
            d.staff_id,
            d.staff_id as "staffId",
            s.user_id,
            s.user_id as "userId",
            u.name,
            u.email,
            d.specialization,
            dept.name as department,
            d.license_number,
            d.license_number as "licenseNumber",
            d.consultation_minutes,
            s.status,
            s.employee_code,
            s.employee_code as "employeeCode",
            d.created_at,
            d.created_at as "createdAt"
        FROM "doctors" d
        JOIN "staff_profiles" s ON d.staff_id = s.id
        JOIN "users" u ON s.user_id = u.id
        LEFT JOIN "departments" dept ON s.department_id = dept.id
        ORDER BY d.created_at DESC
    `;

    const result = await pool.query(query);
    return { doctors: result.rows };
}

export async function getAdminDashboardService() {
    const [staffCountRes, activeVisitsRes, pendingInvoicesRes] = await Promise.all([
        pool.query(`
            SELECT staff_role as role, count(*)::int as count
            FROM "staff_profiles"
            GROUP BY staff_role
        `),
        pool.query(`
            SELECT count(*)::int as count
            FROM "visits"
            WHERE status NOT IN ('COMPLETED', 'CANCELLED')
              AND checked_in_at >= CURRENT_DATE
        `),
        pool.query(`
            SELECT count(*)::int as count
            FROM "invoices"
            WHERE status = 'PENDING'
        `),
    ]);

    const staffByRole: Record<string, number> = {};
    for (const row of staffCountRes.rows) {
        staffByRole[row.role] = row.count;
    }

    return {
        staffCountByRole: staffByRole,
        activeVisitsToday: activeVisitsRes.rows[0]?.count ?? 0,
        pendingInvoicesCount: pendingInvoicesRes.rows[0]?.count ?? 0,
    };
}

export async function listPatientsAdminService() {
    const result = await pool.query(`
        SELECT 
            p.id,
            p.user_id,
            p.name,
            EXTRACT(YEAR FROM age(p.date_of_birth))::int as age,
            p.gender,
            p.phone,
            p.address,
            p.created_at,
            u.email
        FROM "patient_profiles" p
        LEFT JOIN "users" u ON p.user_id = u.id
        ORDER BY p.created_at DESC
    `);

    return { patients: result.rows };
}

export const listPatientsService = listPatientsAdminService;
