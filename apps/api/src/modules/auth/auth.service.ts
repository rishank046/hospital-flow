import bcrypt from "bcrypt";
import pool from "../../database/pool.js";
import jwt from "jsonwebtoken";
import { revokeToken } from "#utils/tokenRevocation.js";
import { AppError } from "#utils/errorHandler.js";

const SALT_ROUNDS = 10;

type LoginResult = {
    token: string;
    user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        staffRole?: string | undefined;
    } | undefined;
    staff?: {
        id: string;
        employeeCode: string;
        role: string;
        status: string;
    } | undefined;
    doctor?: {
        id: string;
        name: string;
        email: string;
        specialization?: string | undefined;
        department?: string | undefined;
    } | undefined;
};

type RegisterResult = {
	email: string;
};

type LogoutResult = {
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

    // 1. Look up User
    const userResult = await pool.query(
        'SELECT id, name, email, password, role FROM "User" WHERE email = $1',
        [email]
    );

    if (userResult.rowCount && userResult.rows[0]) {
        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            throw new AppError("Invalid email or password", 401);
        }

        // Check for Staff membership
        const staffRes = await pool.query(
            `SELECT 
                s.id as staff_id, 
                s.employee_code, 
                s.role as staff_role, 
                s.status as staff_status,
                d.id as doctor_id, 
                d.specialization, 
                COALESCE(dept.name, d.department) as department
             FROM "Staff" s
             LEFT JOIN "Doctor" d ON d.staff_id = s.id
             LEFT JOIN "Department" dept ON d.department_id = dept.id
             WHERE s.user_id = $1`,
            [user.id]
        );

        if (staffRes.rowCount && staffRes.rows[0]) {
            const staffRow = staffRes.rows[0];
            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    role: "STAFF",
                    staffRole: staffRow.staff_role,
                },
                jwtSecret,
                { expiresIn: "4h" }
            );

            return {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: "STAFF",
                    staffRole: staffRow.staff_role,
                },
                staff: {
                    id: staffRow.staff_id,
                    employeeCode: staffRow.employee_code,
                    role: staffRow.staff_role,
                    status: staffRow.staff_status,
                },
                doctor: staffRow.doctor_id
                    ? {
                          id: staffRow.doctor_id,
                          name: user.name,
                          email: user.email,
                          specialization: staffRow.specialization,
                          department: staffRow.department,
                      }
                    : undefined,
            };
        }

        const role = user.role === "ADMIN" ? "ADMIN" : "USER";
        const token = jwt.sign(
            { userId: user.id, email: user.email, role },
            jwtSecret,
            { expiresIn: "4h" }
        );

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role,
            },
        };
    }

    // 2. Fallback check for Admin table
    const adminResult = await pool.query(
        'SELECT id, name, email, password FROM "Admin" WHERE email = $1',
        [email]
    );

    if (adminResult.rowCount && adminResult.rows[0]) {
        const admin = adminResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            throw new AppError("Invalid email or password", 401);
        }

        const token = jwt.sign(
            { userId: admin.id, email: admin.email, role: "ADMIN" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        return {
            token,
            user: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: "ADMIN",
            },
        };
    }

    // 3. Fallback check for Doctor table (legacy)
    const docResult = await pool.query(
        'SELECT id, name, email, password, specialization, department FROM "Doctor" WHERE email = $1',
        [email]
    );

    if (docResult.rowCount && docResult.rows[0] && docResult.rows[0].password) {
        const doctor = docResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, doctor.password);
        if (!passwordMatch) {
            throw new AppError("Invalid email or password", 401);
        }

        const token = jwt.sign(
            {
                userId: doctor.id,
                email: doctor.email ?? email,
                role: "STAFF",
                staffRole: "DOCTOR",
            },
            jwtSecret,
            { expiresIn: "4h" }
        );

        return {
            token,
            user: {
                id: doctor.id,
                name: doctor.name ?? "Doctor",
                email: doctor.email ?? email,
                role: "STAFF",
                staffRole: "DOCTOR",
            },
            doctor: {
                id: doctor.id,
                name: doctor.name ?? "Doctor",
                email: doctor.email ?? email,
                specialization: doctor.specialization,
                department: doctor.department,
            },
        };
    }

    throw new AppError("Invalid email or password", 401);
}

export async function registerService(name: string, email: string, password: string): Promise<RegisterResult> {
	const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

	const result = await pool.query(
		'INSERT INTO "User" (name, email, password) VALUES ($1, $2, $3) RETURNING id, email',
		[name, email, hashedPassword],
	);

	if (result.rowCount === 0 || !result.rows[0]) {
		throw new Error("Failed to register user");
	}

	return { email: result.rows[0].email };
}

export async function logoutService(token: string): Promise<LogoutResult> {
	const decodedToken = jwt.decode(token);

	if (!decodedToken || typeof decodedToken === "string" || typeof decodedToken.exp !== "number") {
		throw new Error("Invalid token");
	}

	revokeToken(token, decodedToken.exp * 1000);

	return { message: "Logged out successfully" };
}