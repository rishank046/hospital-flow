import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    getMyStaffProfile,
    getStaffById,
    listStaff,
} from "./staff.controller.js";

const router = express.Router();

router.get("/me", authenticate, requireRole("STAFF"), wrapper(getMyStaffProfile));
router.get("/:staffId", authenticate, wrapper(getStaffById));
router.get("/", authenticate, wrapper(listStaff));

export default router;
