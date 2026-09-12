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

        request.tokenPayload = decodedToken as AuthPayload;

        next();
    } catch (error) {
        response.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

export const requireRole = (_role: string): RequestHandler => (
    _request: Request,
    response: Response,
    _next: NextFunction,
) => {
    response.status(501).json({ message: "Role authorization middleware not implemented" });
};