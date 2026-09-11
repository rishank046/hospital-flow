import pool from "#database/pool.js";
import signtoken from "#utils/signTokenWrapper.js";
type LoginResult = {
    token: string;
};

type RegisterResult = {
	email: string;
	password: string;
};

export async function loginService(email: string, password: string): Promise<LoginResult> {
	const result = await pool.query(
		"SELECT id, email, password FROM users WHERE email = $1 AND password = $2",
		[email, password],
	);

    const token = await signtoken({ "role" : "user" , "email" : email }, process.env.JWT_SECRET || "default_secret", { expiresIn: "4h" });

	if (result.rowCount === 0) {
		throw new Error("Invalid email or password");
	}

	return { token: token };
}

export async function registerService(name: string, email: string, password: string): Promise<RegisterResult> {
	const result = await pool.query(
		"INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING email, password",
		[name, email, password],
	);

	if (result.rowCount === 0) {
		throw new Error("Failed to register user");
	}

	return { email: result.rows[0].email, password: result.rows[0].password };
}