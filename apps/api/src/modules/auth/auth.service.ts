import pool from "../../database/pool.js";
import jwt from "jsonwebtoken";

type LoginResult = {
    token: string;
};

export async function loginService(email: string, password: string): Promise<LoginResult> {
	const result = await pool.query(
		"SELECT id, email, password FROM users WHERE email = $1 AND password = $2",
		[email, password],
	);

    const token = jwt.sign({ "role" : "user" , "email" : email }, process.env.JWT_SECRET || "default_secret", { expiresIn: "4h" });

	if (result.rowCount === 0) {
		throw new Error("Invalid email or password");
	}

	return { token: token };
}