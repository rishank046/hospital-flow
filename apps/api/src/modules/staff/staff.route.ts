import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    getMyStaffProfile,
    getStaffById,
    listStaff,
    staffLogin,
} from "./staff.controller.js";

const router = express.Router();

router.post("/login", wrapper(staffLogin));
router.get("/me", authenticate, requireRole("STAFF"), wrapper(getMyStaffProfile));
router.get("/:staffId", authenticate, wrapper(getStaffById));
router.get("/", authenticate, wrapper(listStaff));

export default router;
