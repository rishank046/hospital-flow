import type { Request, Response } from "express";
import { AppError } from "#utils/errorHandler.js";
import {
    appointmentIdParamSchema,
    bookAppointmentSchema,
    updatePatientProfileSchema,
} from "./patient.schema.js";
import {
    bookAppointmentService,
    cancelAppointmentService,
    getMyAppointmentsService,
    getMyConsultationsService,
    getMyJourneyService,
    getMyPrescriptionsService,
    getMyProfileService,
    getMyReportsService,
    updateMyProfileService,
} from "./patients.service.js";

const notImplemented = (_request: Request, response: Response) => {
    response.status(501).json({ message: "Patient queue endpoint not implemented" });
};

function getAuthContext(request: Request): { userId: string; email: string } {
    const userId = request.tokenPayload?.userId;
    const email = request.tokenPayload?.email;

    if (!userId && !email) {
        throw new AppError("Authentication identity missing from token", 401);
    }

    return {
        userId: userId ?? "",
        email: email ?? "",
    };
}

export async function getMyProfile(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const profile = await getMyProfileService(userId, email);
    response.status(200).json(profile);
}

export async function updateMyProfile(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const parsedBody = updatePatientProfileSchema.parse(request.body);
    const updated = await updateMyProfileService(userId, email, parsedBody);
    response.status(200).json(updated);
}

export async function getMyAppointments(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const result = await getMyAppointmentsService(userId, email);
    response.status(200).json(result);
}

export async function bookAppointment(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const parsedBody = bookAppointmentSchema.parse(request.body);
    const appointment = await bookAppointmentService(userId, email, parsedBody);
    response.status(201).json(appointment);
}

export async function cancelAppointment(request: Request, response: Response) {
    const { userId } = getAuthContext(request);
    const { appointmentId } = appointmentIdParamSchema.parse(request.params);
    const result = await cancelAppointmentService(userId, appointmentId);
    response.status(200).json(result);
}

export async function getMyJourney(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const journey = await getMyJourneyService(userId, email);
    response.status(200).json(journey);
}

export async function getMyConsultations(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const consultations = await getMyConsultationsService(userId, email);
    response.status(200).json(consultations);
}

export async function getMyReports(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const reports = await getMyReportsService(userId, email);
    response.status(200).json(reports);
}

export async function getMyPrescriptions(request: Request, response: Response) {
    const { userId, email } = getAuthContext(request);
    const prescriptions = await getMyPrescriptionsService(userId, email);
    response.status(200).json(prescriptions);
}

// Queue endpoint intentionally left not implemented
export const getMyQueueStatus = notImplemented;
