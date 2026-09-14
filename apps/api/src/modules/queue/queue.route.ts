import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    callNext,
    completeQueueEntry,
    getMyDoctorQueue,
    getMyPatientQueue,
    getQueue,
    joinQueue,
    requeueQueueEntry,
    skipDoctorActive,
    skipQueueEntry,
    startServing,
} from "./queue.controller.js";

const router = express.Router();

router.post("/join", authenticate, wrapper(joinQueue));
router.get("/", authenticate, wrapper(getQueue));
router.get("/patient/me", authenticate, wrapper(getMyPatientQueue));
router.get("/doctor/me", authenticate, requireRole("DOCTOR"), wrapper(getMyDoctorQueue));
router.post("/doctor/call-next", authenticate, requireRole("DOCTOR"), wrapper(callNext));
router.post("/doctor/skip", authenticate, requireRole("DOCTOR"), wrapper(skipDoctorActive));
router.post("/:queueEntryId/start", authenticate, requireRole("DOCTOR"), wrapper(startServing));
router.post("/:queueEntryId/complete", authenticate, requireRole("DOCTOR"), wrapper(completeQueueEntry));
router.post("/:queueEntryId/skip", authenticate, wrapper(skipQueueEntry));
router.post("/:queueEntryId/requeue", authenticate, wrapper(requeueQueueEntry));

export default router;
