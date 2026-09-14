import type { NextFunction, Request, RequestHandler, Response } from "express";
import pool from "#database/pool.js";
import type { AuthPayload, StaffRole, SystemRole } from "#types/auth.types.js";
import { verifyToken } from "#utils/signTokenWrapper.js";
import { isTokenRevoked } from "#utils/tokenRevocation.js";

export type { AuthPayload, StaffRole, SystemRole };

export async function authenticate(
    request: Request,
    response: Response,
    next: NextFunction
) {
    try {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            response.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            response.status(401).json({
                message: "Authentication token missing"
            });
            return;
        }

        if (isTokenRevoked(token)) {
            response.status(401).json({
                message: "Token has been revoked",
            });
            return;
        }

        const decodedToken = await verifyToken<AuthPayload>(
            token,
            process.env.JWT_SECRET!
        );

        const payload = decodedToken as Record<string, unknown>;
        const rawRole = String(payload["role"] ?? "USER").toUpperCase();
        
        let role: SystemRole = "USER";
        let staffRole: StaffRole | undefined = typeof payload["staffRole"] === "string" 
            ? (payload["staffRole"] as StaffRole) 
            : undefined;

        if (rawRole === "ADMIN") {
            role = "ADMIN";
        } else if (rawRole === "STAFF" || rawRole === "DOCTOR") {
            role = "STAFF";
            if (rawRole === "DOCTOR" && !staffRole) {
                staffRole = "DOCTOR";
            }
        } else {
            role = "USER";
        }

        const userId = String(payload["userId"] ?? payload["id"] ?? "");
        const email = String(payload["email"] ?? "");

        const authData: AuthPayload = {
            userId,
            email,
            role,
            ...(staffRole ? { staffRole } : {}),
        };

        request.user = authData;
        request.tokenPayload = authData;

        next();
    } catch (error) {
        response.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

export const requireRole = (
    role: "USER" | "STAFF" | "ADMIN" | "DOCTOR" | "PATIENT"
): RequestHandler => (
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    const user = request.user || request.tokenPayload;
    if (!user) {
        response.status(401).json({ message: "Authentication required" });
        return;
    }

    const userRole = user.role;
    const isPatientMatch = (role === "PATIENT" || role === "USER") && (userRole === "PATIENT" || userRole === "USER");
    const isDoctorMatch = role === "DOCTOR" && userRole === "STAFF" && user.staffRole === "DOCTOR";
    const isStaffMatch = role === "STAFF" && userRole === "STAFF";
    const isExactMatch = (userRole as string) === role;

    if (!isPatientMatch && !isDoctorMatch && !isStaffMatch && !isExactMatch) {
        response.status(403).json({ message: "Forbidden: insufficient permissions" });
        return;
    }

    next();
};

export const requireStaffRole = (
    ...allowedRoles: StaffRole[]
): RequestHandler => async (
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    const user = request.user || request.tokenPayload;
    if (!user) {
        response.status(401).json({ message: "Authentication required" });
        return;
    }

    if (user.role !== "STAFF" && user.role !== "ADMIN") {
        response.status(403).json({ message: "Forbidden: staff access required" });
        return;
    }

    // Check staffRole directly from token payload
    if (user.staffRole) {
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.staffRole)) {
            response.status(403).json({ message: "Forbidden: insufficient staff role" });
            return;
        }
        return next();
    }

    // Fallback: Look up Staff record for this User
    try {
        const staffRes = await pool.query<{ staff_role: StaffRole; status: string }>(
            'SELECT staff_role, status FROM "staff_profiles" WHERE user_id = $1',
            [user.userId]
        );

        if (staffRes.rowCount && staffRes.rowCount > 0 && staffRes.rows[0]) {
            const staff = staffRes.rows[0];
            if (staff.status !== "ACTIVE") {
                response.status(403).json({ message: "Forbidden: staff account is inactive" });
                return;
            }

            if (allowedRoles.length > 0 && !allowedRoles.includes(staff.staff_role)) {
                response.status(403).json({ message: "Forbidden: insufficient staff role" });
                return;
            }

            // Cache on request.user
            user.staffRole = staff.staff_role;
            return next();
        }

        response.status(403).json({ message: "Forbidden: staff profile not found" });
    } catch (err) {
        next(err);
    }
};
