import type { Request, Response } from "express";
import { AppError } from "#utils/errorHandler.js";
import {
    appointmentIdParamSchema,
    bookAppointmentSchema,
    createPatientProfileSchema,
    patientIdParamSchema,
    updatePatientProfileSchema,
} from "./patient.schema.js";
import {
    bookAppointmentService,
    cancelAppointmentService,
    createPatientProfileService,
    getMyAppointmentsService,
    getMyConsultationsService,
    getMyJourneyService,
    getMyPrescriptionsService,
    getMyProfileService,
    getMyReportsService,
    getPatientProfileByIdService,
    listMyPatientsService,
    updateMyProfileService,
    updatePatientProfileByIdService,
} from "./patients.service.js";
import { getMyPatientQueueStatusService } from "#modules/queue/queue.service.js";

const notImplemented = (_request: Request, response: Response) => {
    response.status(501).json({ message: "Patient queue endpoint not implemented" });
};

function getAuthContext(request: Request): { userId: string; email: string; isStaff: boolean } {
    const userId = request.user?.userId || request.tokenPayload?.userId;
    const email = request.user?.email || request.tokenPayload?.email;

    if (!userId && !email) {
        throw new AppError("Authentication identity missing from token", 401);
    }

    const role = request.user?.role || request.tokenPayload?.role;
    const isStaff = role === "STAFF" || role === "ADMIN";

    return {
        userId: userId ?? "",
        email: email ?? "",
        isStaff,
    };
}

export async function listMyPatients(request: Request, response: Response) {
    const { userId } = getAuthContext(request);
    const result = await listMyPatientsService(userId);
    response.status(200).json(result);
}

export async function createPatient(request: Request, response: Response) {
    const { userId } = getAuthContext(request);
    const parsed = createPatientProfileSchema.parse(request.body);
    const created = await createPatientProfileService(userId, parsed);
    response.status(201).json(created);
}

export async function getPatientById(request: Request, response: Response) {
    const { userId, isStaff } = getAuthContext(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const patient = await getPatientProfileByIdService(userId, patientId, isStaff);
    response.status(200).json(patient);
}

export async function updatePatientById(request: Request, response: Response) {
    const { userId } = getAuthContext(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const parsed = updatePatientProfileSchema.parse(request.body);
    const updated = await updatePatientProfileByIdService(userId, patientId, parsed);
    response.status(200).json(updated);
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

export async function getMyQueueStatus(request: Request, response: Response) {
    const { userId } = getAuthContext(request);
    const result = await getMyPatientQueueStatusService(userId);
    response.status(200).json(result);
}
