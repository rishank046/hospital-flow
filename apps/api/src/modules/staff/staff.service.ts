import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";

export async function getStaffProfileService(userId: string) {
    const result = await pool.query(
        `SELECT 
            s.id as staff_id,
            s.user_id,
            s.employee_code,
            s.staff_role as role,
            s.staff_role,
            s.status as staff_status,
            s.status,
            s.created_at,
            u.name,
            u.email,
            u.role as system_role,
            d.id as doctor_id,
            d.specialization,
            d.license_number,
            dept.name as department
         FROM "staff_profiles" s
         JOIN "users" u ON s.user_id = u.id
         LEFT JOIN "doctors" d ON d.staff_id = s.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
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
            s.staff_role as role,
            s.staff_role,
            s.status as staff_status,
            s.status,
            s.created_at,
            u.name,
            u.email,
            u.role as system_role,
            d.id as doctor_id,
            d.specialization,
            d.license_number,
            dept.name as department
         FROM "staff_profiles" s
         JOIN "users" u ON s.user_id = u.id
         LEFT JOIN "doctors" d ON d.staff_id = s.id
         LEFT JOIN "departments" dept ON s.department_id = dept.id
         WHERE s.id = $1`,
        [staffId]
    );

    if (result.rowCount === 0 || !result.rows[0]) {
        throw new AppError("Staff member not found", 404);
    }

    return result.rows[0];
}

export {
    createStaffService,
    updateStaffService,
    updateStaffStatusService,
    listStaffService,
} from "#modules/admin/admin.service.js";
