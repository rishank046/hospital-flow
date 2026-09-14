import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "#database/pool.js";
import { revokeToken } from "#utils/tokenRevocation.js";
import { AppError } from "#utils/errorHandler.js";
import type { StaffRole } from "#types/auth.types.js";

const SALT_ROUNDS = 10;

export type LoginResult = {
    success: boolean;
    message: string;
    data: {
        token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: "USER" | "STAFF" | "ADMIN";
            staffRole?: StaffRole | undefined;
        };
        staff: {
            id: string;
            staffRole: StaffRole;
            role?: StaffRole;
            employeeCode?: string;
            status?: string;
            department?: string;
        } | null;
        doctor?: {
            id: string;
            name: string;
            email: string;
            specialization?: string | undefined;
            department?: string | undefined;
        } | null;
    };
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: "USER" | "STAFF" | "ADMIN";
        staffRole?: StaffRole | undefined;
    };
    staff?: {
        id: string;
        staffRole: StaffRole;
        role?: StaffRole;
        employeeCode?: string;
        status?: string;
    } | null;
    doctor?: {
        id: string;
        name: string;
        email: string;
        specialization?: string | undefined;
        department?: string | undefined;
    } | null;
    admin?: {
        id: string;
        name: string;
        email: string;
    } | undefined;
};

export type RegisterResult = {
    email: string;
};

export type LogoutResult = {
    message: string;
};

export async function loginService(email: string, password: string): Promise<LoginResult> {
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

    // Look up by email in users joined with staff_profiles, doctors, and departments
    const userResult = await pool.query(
        `SELECT 
            u.id, 
            u.name, 
            u.email, 
            u.password, 
            u.role,
            u.is_active,
            sp.id as staff_id,
            sp.employee_code,
            sp.staff_role,
            sp.status as staff_status,
            d.id as doctor_id, 
            d.specialization, 
            dept.name as department
         FROM "users" u
         LEFT JOIN "staff_profiles" sp ON sp.user_id = u.id
         LEFT JOIN "doctors" d ON d.staff_id = sp.id
         LEFT JOIN "departments" dept ON sp.department_id = dept.id
         WHERE u.email = $1`,
        [email]
    );

    if (userResult.rowCount && userResult.rows[0]) {
        const row = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, row.password);
        if (!passwordMatch) {
            throw new AppError("Invalid email or password", 401);
        }

        if (row.is_active === false || (row.role === "STAFF" && row.staff_status === "INACTIVE")) {
            throw new AppError("Account is inactive", 403);
        }

        const rawRole = String(row.role ?? "USER").toUpperCase();
        let role: "USER" | "STAFF" | "ADMIN" = "USER";
        let staffRole: StaffRole | undefined = undefined;

        if (rawRole === "ADMIN") {
            role = "ADMIN";
        } else if (rawRole === "STAFF" || row.staff_id) {
            role = "STAFF";
            staffRole = (row.staff_role as StaffRole) || (row.doctor_id ? "DOCTOR" : undefined);
        } else {
            role = "USER";
        }

        const tokenPayload: {
            userId: string;
            email: string;
            role: "USER" | "STAFF" | "ADMIN";
            staffRole?: StaffRole;
        } = {
            userId: row.id,
            email: row.email,
            role,
        };

        if (role === "STAFF" && staffRole) {
            tokenPayload.staffRole = staffRole;
        }

        const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "4h" });

        const userObj = {
            id: row.id,
            name: row.name,
            email: row.email,
            role,
            ...(role === "STAFF" && staffRole ? { staffRole } : {}),
        };

        const staffObj = (role === "STAFF" && (row.staff_id || staffRole)) ? {
            id: row.staff_id || "",
            employeeCode: row.employee_code,
            staffRole: (staffRole || row.staff_role) as StaffRole,
            role: (staffRole || row.staff_role) as StaffRole,
            status: row.staff_status || "ACTIVE",
            department: row.department,
        } : null;

        const doctorObj = (role === "STAFF" && staffRole === "DOCTOR" && row.doctor_id) ? {
            id: row.doctor_id,
            name: row.name,
            email: row.email,
            specialization: row.specialization,
            department: row.department,
        } : null;

        const result: LoginResult = {
            success: true,
            message: "Login successful",
            data: {
                token,
                user: userObj,
                staff: staffObj,
                ...(doctorObj ? { doctor: doctorObj } : {}),
            },
            token,
            user: userObj,
            staff: staffObj,
            ...(doctorObj ? { doctor: doctorObj } : {}),
        };

        if (role === "ADMIN") {
            result.admin = {
                id: row.id,
                name: row.name,
                email: row.email,
            };
        }

        return result;
    }

    throw new AppError("Invalid email or password", 401);
}

export async function meService(userId: string) {
    const userResult = await pool.query(
        `SELECT 
            u.id, 
            u.name, 
            u.email, 
            u.role,
            u.is_active,
            sp.id as staff_id,
            sp.employee_code,
            sp.staff_role,
            sp.status as staff_status,
            d.id as doctor_id, 
            d.specialization, 
            dept.name as department
         FROM "users" u
         LEFT JOIN "staff_profiles" sp ON sp.user_id = u.id
         LEFT JOIN "doctors" d ON d.staff_id = sp.id
         LEFT JOIN "departments" dept ON sp.department_id = dept.id
         WHERE u.id = $1`,
        [userId]
    );

    if (!userResult.rowCount || !userResult.rows[0]) {
        throw new AppError("User not found", 404);
    }

    const row = userResult.rows[0];
    if (row.is_active === false || (row.role === "STAFF" && row.staff_status === "INACTIVE")) {
        throw new AppError("Account is inactive", 403);
    }

    const rawRole = String(row.role ?? "USER").toUpperCase();
    let role: "USER" | "STAFF" | "ADMIN" = "USER";
    let staffRole: StaffRole | undefined = undefined;

    if (rawRole === "ADMIN") {
        role = "ADMIN";
    } else if (rawRole === "STAFF" || row.staff_id) {
        role = "STAFF";
        staffRole = (row.staff_role as StaffRole) || (row.doctor_id ? "DOCTOR" : undefined);
    } else {
        role = "USER";
    }

    const userObj = {
        id: row.id,
        name: row.name,
        email: row.email,
        role,
        ...(role === "STAFF" && staffRole ? { staffRole } : {}),
    };

    const staffObj = (role === "STAFF" && (row.staff_id || staffRole)) ? {
        id: row.staff_id || "",
        employeeCode: row.employee_code,
        staffRole: (staffRole || row.staff_role) as StaffRole,
        role: (staffRole || row.staff_role) as StaffRole,
        status: row.staff_status || "ACTIVE",
        department: row.department,
    } : null;

    const doctorObj = (role === "STAFF" && staffRole === "DOCTOR" && row.doctor_id) ? {
        id: row.doctor_id,
        name: row.name,
        email: row.email,
        specialization: row.specialization,
        department: row.department,
    } : null;

    return {
        success: true,
        message: "Current session retrieved",
        data: {
            user: userObj,
            staff: staffObj,
            ...(doctorObj ? { doctor: doctorObj } : {}),
        },
        user: userObj,
        staff: staffObj,
        ...(doctorObj ? { doctor: doctorObj } : {}),
    };
}

export async function registerService(
    name: string,
    email: string,
    password: string,
    role?: string
): Promise<RegisterResult> {
    if (role) {
        const normalized = role.toUpperCase();
        if (normalized === "STAFF" || normalized === "ADMIN" || normalized === "DOCTOR") {
            throw new AppError("Registration with role STAFF or ADMIN is not permitted", 400);
        }
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
        const result = await pool.query(
            'INSERT INTO "users" (name, email, password, role) VALUES ($1, $2, $3, \'USER\') RETURNING id, email',
            [name, email, hashedPassword],
        );

        if (result.rowCount === 0 || !result.rows[0]) {
            throw new AppError("Failed to register user", 500);
        }

        const userId = result.rows[0].id;

        // Ensure default patient_profile exists for newly registered user
        await pool.query(
            `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender)
             VALUES ($1, $2, '2000-01-01', 'Other')`,
            [userId, name]
        );

        return { email: result.rows[0].email };
    } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "23505"
        ) {
            throw new AppError("User with this email already exists", 409);
        }
        throw err;
    }
}

export async function logoutService(token: string): Promise<LogoutResult> {
    const decodedToken = jwt.decode(token);

    if (!decodedToken || typeof decodedToken === "string" || typeof decodedToken.exp !== "number") {
        throw new AppError("Invalid token", 400);
    }

    revokeToken(token, decodedToken.exp * 1000);

    return { message: "Logged out successfully" };
}
