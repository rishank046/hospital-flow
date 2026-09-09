import express from 'express';
import {
    completeQueueEntry,
    createConsultation,
    createInvestigationOrder,
    getMyPatients,
    getMyProfile,
    getMyQueue,
    getMySchedule,
    getPatient,
    getPatientReports,
    skipQueueEntry,
    updateConsultation,
    updateMyProfile,
    login
} from './doctors.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
const router = express.Router();

router.post("/login", login);

router.get(
    "/me",
    authenticate,
    requireRole("DOCTOR"),
    getMyProfile
);

router.patch(
    "/me",
    authenticate,
    requireRole("DOCTOR"),
    updateMyProfile
);

router.get(
    "/me/schedule",
    authenticate,
    requireRole("DOCTOR"),
    getMySchedule
);

router.get(
    "/me/queue",
    authenticate,
    requireRole("DOCTOR"),
    getMyQueue
);

router.get(
    "/me/patients",
    authenticate,
    requireRole("DOCTOR"),
    getMyPatients
);

router.get(
    "/patients/:patientId",
    authenticate,
    requireRole("DOCTOR"),
    getPatient
);

router.post(
    "/patients/:patientId/consultation",
    authenticate,
    requireRole("DOCTOR"),
    createConsultation
);

router.patch(
    "/consultations/:consultationId",
    authenticate,
    requireRole("DOCTOR"),
    updateConsultation
);

router.post(
    "/patients/:patientId/orders",
    authenticate,
    requireRole("DOCTOR"),
    createInvestigationOrder
);

router.get(
    "/patients/:patientId/reports",
    authenticate,
    requireRole("DOCTOR"),
    getPatientReports
);

router.post(
    "/queue/:queueEntryId/complete",
    authenticate,
    requireRole("DOCTOR"),
    completeQueueEntry
);

router.post(
    "/queue/:queueEntryId/skip",
    authenticate,
    requireRole("DOCTOR"),
    skipQueueEntry
);

export default router;