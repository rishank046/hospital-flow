import type { Request, Response } from "express";
import {
    appointmentIdParamSchema,
    checkAvailabilitySchema,
    createAppointmentSchema,
    listAppointmentsQuerySchema,
} from "./appointments.schema.js";
import {
    bookAppointmentService,
    cancelAppointmentService,
    checkInAppointmentService,
    getDoctorAvailabilityService,
    listAppointmentsService,
} from "./appointments.service.js";

export async function bookAppointment(request: Request, response: Response) {
    const parsed = createAppointmentSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const result = await bookAppointmentService(parsed, authUser);
    response.status(201).json(result);
}

export async function getDoctorAvailability(request: Request, response: Response) {
    const rawDoctorId = request.params.doctorId || request.query.doctorId || request.query.doctor_id;
    const rawDate = request.query.date || request.params.date;

    const parsed = checkAvailabilitySchema.parse({
        doctorId: rawDoctorId,
        date: rawDate,
    });

    const result = await getDoctorAvailabilityService(parsed.doctorId!, parsed.date);
    response.status(200).json(result);
}

export async function checkInAppointment(request: Request, response: Response) {
    const { appointmentId } = appointmentIdParamSchema.parse(request.params);
    const authUser = request.user || request.tokenPayload;
    const result = await checkInAppointmentService(appointmentId, authUser);
    response.status(200).json(result);
}

export async function cancelAppointment(request: Request, response: Response) {
    const { appointmentId } = appointmentIdParamSchema.parse(request.params);
    const authUser = request.user || request.tokenPayload;
    const result = await cancelAppointmentService(appointmentId, authUser);
    response.status(200).json(result);
}

export async function listAppointments(request: Request, response: Response) {
    const parsed = listAppointmentsQuerySchema.parse(request.query);
    const authUser = request.user || request.tokenPayload;
    const result = await listAppointmentsService(parsed, authUser);
    response.status(200).json(result);
}
