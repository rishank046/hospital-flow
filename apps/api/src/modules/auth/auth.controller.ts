import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "#modules/auth/auth.schema.js";
import { loginService, logoutService, meService, registerService } from "#modules/auth/auth.service.js";
import { AppError } from "#utils/errorHandler.js";
const notImplemented = (_request: Request, response: Response) => {
	response.status(501).json({ message: "Authentication endpoint not implemented" });
};

const authController = {
	login: notImplemented,
	register: notImplemented,
	logout: notImplemented,
	me: notImplemented,
	refresh: notImplemented,
	forgotPassword: notImplemented,
	resetPassword: notImplemented,
};

async function login(request: Request, response: Response) {
	const { email, password } = loginSchema.parse(request.body);
	const result = await loginService(email, password);

	response.status(200).json(result);
}

async function me(request: Request, response: Response) {
    const userId = request.user?.userId || request.tokenPayload?.userId;
    if (!userId) {
        throw new AppError("Authentication identity missing", 401);
    }
    const result = await meService(userId);
    response.status(200).json(result);
}

async function register(request: Request, response: Response) {
    if (request.body && typeof request.body === "object") {
        const role = (request.body as Record<string, unknown>).role;
        if (typeof role === "string") {
            const normalized = role.toUpperCase();
            if (normalized === "STAFF" || normalized === "ADMIN" || normalized === "DOCTOR") {
                throw new AppError("Registration with role STAFF or ADMIN is not permitted", 400);
            }
        }
    }

    const { name, email, password, role } = registerSchema.parse(request.body);
    await registerService(name, email, password, role);
    await login(request, response);
}


async function logout(request: Request, response: Response) {
	const authHeader = request.headers.authorization;
	const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

	if (!token) {
		response.status(401).json({ message: "Authentication token missing" });
		return;
	}

	const result = await logoutService(token);
	response.status(200).json(result);
}

authController.login = login;
authController.register = register;
authController.logout = logout;
authController.me = me;

export default authController;
