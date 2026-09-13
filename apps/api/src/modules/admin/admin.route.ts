import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    createDoctor,
    createStaff,
    listDoctors,
    listPatients,
    listStaff,
    login,
    updateStaff,
    updateStaffStatus,
} from "./admin.controller.js";

const router = express.Router();

router.post("/login", wrapper(login));

router.post(
    "/doctors",
    authenticate,
    requireRole("ADMIN"),
    wrapper(createDoctor)
);

router.get(
    "/doctors",
    authenticate,
    requireRole("ADMIN"),
    wrapper(listDoctors)
);

router.get(
    "/patients",
    authenticate,
    requireRole("ADMIN"),
    wrapper(listPatients)
);

router.post(
    "/staff",
    authenticate,
    requireRole("ADMIN"),
    wrapper(createStaff)
);

router.get(
    "/staff",
    authenticate,
    requireRole("ADMIN"),
    wrapper(listStaff)
);

router.patch(
    "/staff/:staffId",
    authenticate,
    requireRole("ADMIN"),
    wrapper(updateStaff)
);

router.patch(
    "/staff/:staffId/status",
    authenticate,
    requireRole("ADMIN"),
    wrapper(updateStaffStatus)
);

export default router;
