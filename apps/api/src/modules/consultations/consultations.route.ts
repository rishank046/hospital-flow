import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    createConsultation,
    getConsultationById,
    updateConsultation,
} from "./consultations.controller.js";

const router = express.Router();

router.get("/:consultationId", authenticate, wrapper(getConsultationById));
router.patch("/:consultationId", authenticate, requireRole("DOCTOR"), wrapper(updateConsultation));
router.post("/patient/:patientId", authenticate, requireRole("DOCTOR"), wrapper(createConsultation));

export default router;
