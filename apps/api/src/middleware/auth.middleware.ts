import type { NextFunction, Request, RequestHandler, Response } from "express";

import { verifyToken } from "#utils/signTokenWrapper.js";
import { isTokenRevoked } from "#utils/tokenRevocation.js";

export interface AuthPayload {
    userId: string;
    email: string;
    role: "USER" | "ADMIN" | "DOCTOR" | "PATIENT";
}

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
        const rawRole = (typeof payload["role"] === "string" ? payload["role"] : "PATIENT").toUpperCase();
        const role = (rawRole === "USER" || rawRole === "ADMIN" || rawRole === "DOCTOR" || rawRole === "PATIENT" ? rawRole : "PATIENT") as AuthPayload["role"];
        const userId = String(payload["userId"] ?? payload["id"] ?? "");
        const email = String(payload["email"] ?? "");

        request.tokenPayload = {
            userId,
            email,
            role,
        };

        next();
    } catch (error) {
        response.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

export const requireRole = (role: "USER" | "ADMIN" | "DOCTOR" | "PATIENT"): RequestHandler => (
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    if (!request.tokenPayload) {
        response.status(401).json({ message: "Authentication required" });
        return;
    }

    const userRole = request.tokenPayload.role;
    const isPatientMatch = role === "PATIENT" && (userRole === "PATIENT" || userRole === "USER");
    const isExactMatch = userRole === role;

    if (!isPatientMatch && !isExactMatch) {
        response.status(403).json({ message: "Forbidden: insufficient permissions" });
        return;
    }

    next();
};