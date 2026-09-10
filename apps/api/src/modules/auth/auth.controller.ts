import type { Request, Response } from "express";
import { loginSchema } from "./auth.schema.js";
import { loginService } from "./auth.service.js";
const notImplemented = (_request: Request, response: Response) => {
	response.status(501).json({ message: "Authentication endpoint not implemented" });
};

const authController = {
	login: notImplemented,
	register: notImplemented,
	logout: notImplemented,
	refresh: notImplemented,
	forgotPassword: notImplemented,
	resetPassword: notImplemented,
};

async function login(request: Request, response: Response) {
	const { email, password } = loginSchema.parse(request.body);
	const result = await loginService(email, password);

	response.status(200).json({ token: result.token });
}

authController.login = login;

export default authController;
