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
    skipQueueEntry,
    startServing,
} from "./queue.controller.js";

const router = express.Router();

router.post("/join", authenticate, wrapper(joinQueue));
router.get("/", authenticate, wrapper(getQueue));
router.get("/patient/me", authenticate, wrapper(getMyPatientQueue));
router.get("/doctor/me", authenticate, requireRole("DOCTOR"), wrapper(getMyDoctorQueue));
router.post("/doctor/call-next", authenticate, requireRole("DOCTOR"), wrapper(callNext));
router.post("/:queueEntryId/start", authenticate, requireRole("DOCTOR"), wrapper(startServing));
router.post("/:queueEntryId/complete", authenticate, requireRole("DOCTOR"), wrapper(completeQueueEntry));
router.post("/:queueEntryId/skip", authenticate, requireRole("DOCTOR"), wrapper(skipQueueEntry));

export default router;
