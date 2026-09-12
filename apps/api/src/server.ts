import { WebSocketServer } from "ws";
import http from "http";
import app from "#app";
import { setupWebSocket } from "#websocket/websocket.server.js";
import schema from "#database/projectSchema.js";
import pool from "#database/pool.js";

// create tables at database at startup if they don't exist
pool.query(schema).catch((error) => {
  console.error("Database schema initialization error:", error);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = Number(process.env.PORT ?? 3000);

setupWebSocket(wss);

server.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
