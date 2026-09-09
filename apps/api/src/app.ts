import express from "express";
import cors from "cors";
import authRoute from "./modules/auth/auth.route.js";
import patientsRoute from "./modules/patients/patients.route.js";
import doctorRoute from "./modules/doctors/doctors.route.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRoute);
app.use("/patients", patientsRoute);
app.use("/doctors", doctorRoute);

export default app;
