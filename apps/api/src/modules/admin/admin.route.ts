import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    createDoctor,
    listDoctors,
    listPatients,
    login,
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

export default router;
