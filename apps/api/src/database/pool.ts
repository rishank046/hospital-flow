import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const apiDirectory = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

dotenv.config({
	path: path.join(apiDirectory, ".env"),
	override: true,
});

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

export default pool;