import type { Request, Response } from "express";
import { loginSchema , registerSchema} from "#modules/auth/auth.schema.js";
import { loginService , registerService } from "#modules/auth/auth.service.js";
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

async function register(request: Request, response: Response) {
	const { name, email, password } = registerSchema.parse(request.body);
	const result = await registerService(name, email, password);
	await login(request, response);
}

authController.login = login;
authController.register = register;

export default authController;
