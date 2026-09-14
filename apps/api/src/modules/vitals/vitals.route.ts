import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import { getVitalsById, getVitalsByVisit, recordVitals } from "./vitals.controller.js";

const router = express.Router();

// Mounted at /visits (matches /visits/:visitId/vitals)
router.post("/:visitId/vitals", authenticate, requireRole("STAFF"), wrapper(recordVitals));
router.get("/:visitId/vitals", authenticate, wrapper(getVitalsByVisit));

// Mounted at /vitals (matches /vitals/visit/:visitId, /vitals/:id)
router.get("/visit/:visitId", authenticate, wrapper(getVitalsByVisit));
router.get("/byId/:id", authenticate, wrapper(getVitalsById));
router.get("/:id", authenticate, wrapper(getVitalsById));

export default router;
