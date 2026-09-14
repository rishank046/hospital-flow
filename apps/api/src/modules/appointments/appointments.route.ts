import express from "express";
import { authenticate } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    bookAppointment,
    cancelAppointment,
    checkInAppointment,
    getDoctorAvailability,
    listAppointments,
} from "./appointments.controller.js";

const router = express.Router();

router.get("/availability", wrapper(getDoctorAvailability));
router.get("/:doctorId/availability", wrapper(getDoctorAvailability));

router.post("/", authenticate, wrapper(bookAppointment));
router.post("/book", authenticate, wrapper(bookAppointment));

router.post("/:appointmentId/check-in", authenticate, wrapper(checkInAppointment));
router.post("/:appointmentId/cancel", authenticate, wrapper(cancelAppointment));
router.delete("/:appointmentId", authenticate, wrapper(cancelAppointment));

router.get("/", authenticate, wrapper(listAppointments));

export default router;
