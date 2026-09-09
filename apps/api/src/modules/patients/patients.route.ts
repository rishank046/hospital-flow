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
} from "./patients.controller.js";
import { authenticate, requireRole } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", authenticate, requireRole("PATIENT"), getMyProfile);

router.patch("/me", authenticate, requireRole("PATIENT"), updateMyProfile);

router.get(
	"/me/appointments",
	authenticate,
	requireRole("PATIENT"),
	getMyAppointments,
);

router.post(
	"/appointments",
	authenticate,
	requireRole("PATIENT"),
	bookAppointment,
);

router.delete(
	"/appointments/:appointmentId",
	authenticate,
	requireRole("PATIENT"),
	cancelAppointment,
);

router.get(
	"/me/queue",
	authenticate,
	requireRole("PATIENT"),
	getMyQueueStatus,
);

router.get("/me/journey", authenticate, requireRole("PATIENT"), getMyJourney);

router.get(
	"/me/consultations",
	authenticate,
	requireRole("PATIENT"),
	getMyConsultations,
);

router.get("/me/reports", authenticate, requireRole("PATIENT"), getMyReports);

router.get(
	"/me/prescriptions",
	authenticate,
	requireRole("PATIENT"),
	getMyPrescriptions,
);

export default router;
