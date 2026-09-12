import pool from "../../database/pool.js";
import jwt from "jsonwebtoken";
import { revokeToken } from "#utils/tokenRevocation.js";

type LoginResult = {
    token: string;
};

type RegisterResult = {
	email: string;
	password: string;
};

type LogoutResult = {
	message: string;
};

export async function loginService(email: string, password: string): Promise<LoginResult> {
	const result = await pool.query(
		'SELECT id, email, password FROM "User" WHERE email = $1 AND password = $2',
		[email, password],
	);

	if (result.rowCount === 0 || !result.rows[0]) {
		throw new Error("Invalid email or password");
	}

	const user = result.rows[0];
	const token = jwt.sign(
		{ userId: user.id, email: user.email, role: "PATIENT" },
		process.env.JWT_SECRET || "default_secret",
		{ expiresIn: "4h" }
	);

	return { token };
}

export async function registerService(name: string, email: string, password: string): Promise<RegisterResult> {
	const result = await pool.query(
		'INSERT INTO "User" (name, email, password) VALUES ($1, $2, $3) RETURNING id, email, password',
		[name, email, password],
	);

	if (result.rowCount === 0 || !result.rows[0]) {
		throw new Error("Failed to register user");
	}

	return { email: result.rows[0].email, password: result.rows[0].password };
}

export async function logoutService(token: string): Promise<LogoutResult> {
	const decodedToken = jwt.decode(token);

	if (!decodedToken || typeof decodedToken === "string" || typeof decodedToken.exp !== "number") {
		throw new Error("Invalid token");
	}

	revokeToken(token, decodedToken.exp * 1000);

	return { message: "Logged out successfully" };
}