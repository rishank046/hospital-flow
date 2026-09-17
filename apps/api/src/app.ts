import express from "express";
import cors from "cors";
import adminRoute from "#modules/admin/admin.route.js";
import authRoute from "#modules/auth/auth.route.js";
import patientsRoute from "#modules/patients/patients.route.js";
import doctorRoute from "#modules/doctors/doctors.route.js";
import staffRoute from "#modules/staff/staff.route.js";
import queueRoute from "#modules/queue/queue.route.js";
import visitsRoute from "#modules/visits/visits.route.js";
import vitalsRoute from "#modules/vitals/vitals.route.js";
import billingRoute from "#modules/billing/billing.route.js";
import consultationsRoute from "#modules/consultations/consultations.route.js";
import prescriptionsRoute from "#modules/prescriptions/prescriptions.route.js";
import labOrdersRoute from "#modules/lab-orders/lab-orders.route.js";
import workflowRoute from "#modules/workflow/workflow.route.js";
import appointmentsRoute from "#modules/appointments/appointments.route.js";
import errorHandler from "#utils/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/nosleep", function (req, res) {
  res.send("OK");
});
app.use("/admin", adminRoute);
app.use("/auth", authRoute);
app.use("/patients", patientsRoute);
app.use("/doctors", doctorRoute);
app.use("/staff", staffRoute);
app.use("/queue", queueRoute);
app.use("/visits", visitsRoute);
app.use("/visits", vitalsRoute);
app.use("/visits", billingRoute);
app.use("/vitals", vitalsRoute);
app.use("/invoices", billingRoute);
app.use("/billing", billingRoute);
app.use("/consultations", consultationsRoute);
app.use("/prescriptions", prescriptionsRoute);
app.use("/lab-orders", labOrdersRoute);
app.use("/workflow", workflowRoute);
app.use("/appointments", appointmentsRoute);
app.use(errorHandler);

export default app;
