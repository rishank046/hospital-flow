import express from "express";
import {
    bookAppointment,
    cancelAppointment,
    createPatient,
    getMyAppointments,
    getMyConsultations,
    getMyJourney,
    getMyPrescriptions,
    getMyProfile,
    getMyQueueStatus,
    getMyReports,
    getPatientById,
    listMyPatients,
    updateMyProfile,
    updatePatientById,
} from "#modules/patients/patients.controller.js";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";

const router = express.Router();

router.get("/", authenticate, requireRole("USER"), wrapper(listMyPatients));
router.post("/", authenticate, requireRole("USER"), wrapper(createPatient));
router.get("/byId/:patientId", authenticate, wrapper(getPatientById));
router.patch("/byId/:patientId", authenticate, requireRole("USER"), wrapper(updatePatientById));

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
