import express from "express";
import { authenticate, requireStaffRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    dispensePrescription,
    getPrescriptionById,
    getPrescriptions,
} from "./prescriptions.controller.js";

const router = express.Router();

router.get("/", authenticate, wrapper(getPrescriptions));
router.get("/:id", authenticate, wrapper(getPrescriptionById));
router.patch(
    "/:id/dispense",
    authenticate,
    requireStaffRole("PHARMACIST"),
    wrapper(dispensePrescription)
);

export default router;
