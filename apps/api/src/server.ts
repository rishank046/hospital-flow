import { WebSocketServer } from "ws";
import http from "http";
import app from "#app";
import { setupWebSocket } from "#websocket/websocket.server.js";
import schema from "#database/projectSchema.js";
import pool from "#database/pool.js";

function validateJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required. Generate a random secret and set it before starting the API.");
  }

  const normalizedSecret = jwtSecret.toLowerCase();
  const knownWeakSecrets = new Set([
    "default_secret",
    "your_jwt_secret_key_minimum_32_chars",
    "your_jwt_secret",
    "replace_with_a_random_64_char_secret",
  ]);

  if (jwtSecret.length < 32 || knownWeakSecrets.has(normalizedSecret)) {
    throw new Error("JWT_SECRET is too weak. Use a random value with at least 32 characters.");
  }
}

// create tables at database at startup if they don't exist
pool.query(schema)
  .then(async () => {
    await pool.query(`
      ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'PATIENT';
      ALTER TABLE "investigation_orders" ADD COLUMN IF NOT EXISTS report_url TEXT;
      ALTER TABLE "investigation_orders" ADD COLUMN IF NOT EXISTS sample_collected_at TIMESTAMP;
      ALTER TABLE "investigation_orders" ADD COLUMN IF NOT EXISTS resulted_at TIMESTAMP;
    `).catch(() => {});
  })
  .catch((error) => {
    console.error("Database schema initialization error:", error);
  });

validateJwtSecret();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = Number(process.env.PORT ?? 3000);

setupWebSocket(wss);

server.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
