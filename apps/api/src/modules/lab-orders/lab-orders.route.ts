import express from "express";
import { authenticate, requireRole, requireStaffRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    createLabOrder,
    getLabOrderById,
    getLabOrders,
    getPatientReports,
    recordSampleCollection,
    updateLabOrder,
    uploadLabReport,
} from "./lab-orders.controller.js";

const router = express.Router();

router.post("/", authenticate, requireRole("STAFF"), wrapper(createLabOrder));
router.get("/", authenticate, requireRole("STAFF"), wrapper(getLabOrders));
router.get("/:id", authenticate, wrapper(getLabOrderById));
router.patch("/:id", authenticate, requireRole("STAFF"), wrapper(updateLabOrder));
router.post("/:id/sample", authenticate, requireRole("STAFF"), wrapper(recordSampleCollection));
router.post("/:id/sample-collected", authenticate, requireRole("STAFF"), wrapper(recordSampleCollection));
router.post("/:id/report", authenticate, requireRole("STAFF"), wrapper(uploadLabReport));
router.get("/patient/:patientId/reports", authenticate, wrapper(getPatientReports));

export default router;
