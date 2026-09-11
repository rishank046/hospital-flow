import express from "express";
import {
	bookAppointment,
	cancelAppointment,
	getMyAppointments,
	getMyConsultations,
	getMyJourney,
	getMyPrescriptions,
	getMyProfile,
	getMyQueueStatus,
	getMyReports,
	updateMyProfile,
} from "#modules/patients/patients.controller.js";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";

const router = express.Router();

router.get("/me", authenticate, requireRole("PATIENT"), wrapper(getMyProfile));

router.patch("/me", authenticate, requireRole("PATIENT"), wrapper(updateMyProfile));

router.get(
	"/me/appointments",
	authenticate,
	requireRole("PATIENT"),
	wrapper(getMyAppointments),
);

router.post(
	"/appointments",
	authenticate,
	requireRole("PATIENT"),
	wrapper(bookAppointment),
);

router.delete(
	"/appointments/:appointmentId",
	authenticate,
	requireRole("PATIENT"),
	wrapper(cancelAppointment),
);

router.get(
	"/me/queue",
	authenticate,
	requireRole("PATIENT"),
	wrapper(getMyQueueStatus),
);

router.get("/me/journey", authenticate, requireRole("PATIENT"), wrapper(getMyJourney));

router.get(
	"/me/consultations",
	authenticate,
	requireRole("PATIENT"),
	wrapper(getMyConsultations),
);

router.get("/me/reports", authenticate, requireRole("PATIENT"), wrapper(getMyReports));

router.get(
	"/me/prescriptions",
	authenticate,
	requireRole("PATIENT"),
	wrapper(getMyPrescriptions),
);

export default router;
