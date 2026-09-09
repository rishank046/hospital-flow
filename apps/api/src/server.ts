import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import http from "http";
import app from "./app.js";
import { setupWebSocket } from "./websocket/websocket.server.js";

dotenv.config();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = Number(process.env.PORT ?? 3000);

setupWebSocket(wss);

server.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
