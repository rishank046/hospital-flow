import express from "express";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import authRoute from "./modules/auth/auth.route.js";
import patientsRoute from "./modules/patients/patients.route.js";
import doctorRoute from "./modules/doctors/doctors.route.js";
import { setupWebSocket } from "./websocket/websocket.server.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRoute);
app.use("/patients", patientsRoute);
app.use("/doctors", doctorRoute);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = Number(process.env.PORT ?? 3000);

setupWebSocket(wss);

server.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
