import type { Request, Response } from "express";

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

export default authController;
