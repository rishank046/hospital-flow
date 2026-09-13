import express from "express";
import cors from "cors";
import adminRoute from "#modules/admin/admin.route.js";
import authRoute from "#modules/auth/auth.route.js";
import patientsRoute from "#modules/patients/patients.route.js";
import doctorRoute from "#modules/doctors/doctors.route.js";
import errorHandler from "#utils/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/admin", adminRoute);
app.use("/auth", authRoute);
app.use("/patients", patientsRoute);
app.use("/doctors", doctorRoute);
app.use(errorHandler);

export default app;
