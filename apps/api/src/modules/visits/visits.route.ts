import express from "express";
import { authenticate } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    createVisit,
    getCurrentPatientVisit,
    getVisitById,
    listVisits,
    updateVisitStatus,
} from "./visits.controller.js";

const router = express.Router();

// Fallback convenience paths for patient's current visit
router.get("/patients/me/current-visit", authenticate, wrapper(getCurrentPatientVisit));
router.get("/current", authenticate, wrapper(getCurrentPatientVisit));

// Core Visits API
router.get("/", authenticate, wrapper(listVisits));
router.post("/", authenticate, wrapper(createVisit));
router.get("/:id", authenticate, wrapper(getVisitById));
router.patch("/:id/status", authenticate, wrapper(updateVisitStatus));

export default router;
