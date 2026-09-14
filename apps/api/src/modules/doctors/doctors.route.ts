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
    requeueQueueEntry,
    skipDoctorActive,
    skipQueueEntry,
    updateConsultation,
    updateMyProfile,
    login,
    listDoctors,
    getDoctorById,
} from "#modules/doctors/doctors.controller.js";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
const router = express.Router();

router.post("/login", wrapper(login));
router.get("/", wrapper(listDoctors));
router.get("/byId/:doctorId", wrapper(getDoctorById));

router.get(
    "/me",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(getMyProfile)
);

router.patch(
    "/me",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(updateMyProfile)
);

router.get(
    "/me/schedule",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(getMySchedule)
);

router.get(
    "/me/queue",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(getMyQueue)
);

router.get(
    "/me/patients",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(getMyPatients)
);

router.get(
    "/patients/:patientId",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(getPatient)
);

router.post(
    "/patients/:patientId/consultation",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(createConsultation)
);

router.patch(
    "/consultations/:consultationId",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(updateConsultation)
);

router.post(
    "/patients/:patientId/orders",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(createInvestigationOrder)
);

router.get(
    "/patients/:patientId/reports",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(getPatientReports)
);

router.post(
    "/queue/:queueEntryId/complete",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(completeQueueEntry)
);

router.post(
    "/queue/:queueEntryId/skip",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(skipQueueEntry)
);

router.post(
    "/queue/:queueEntryId/requeue",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(requeueQueueEntry)
);

router.post(
    "/queue/skip",
    authenticate,
    requireRole("DOCTOR"),
    wrapper(skipDoctorActive)
);

export default router;