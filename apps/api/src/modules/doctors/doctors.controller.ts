import type { Request, Response } from "express";
import { AppError } from "#utils/errorHandler.js";
import {
    consultationIdParamSchema,
    createConsultationSchema,
    createInvestigationOrderSchema,
    doctorLoginSchema,
    patientIdParamSchema,
    updateConsultationSchema,
    updateDoctorProfileSchema,
} from "./doctor.schema.js";
import {
    createConsultationService,
    createInvestigationOrderService,
    doctorLoginService,
    getDoctorPatientDetailsService,
    getDoctorPatientsService,
    getDoctorProfileService,
    getDoctorScheduleService,
    getPatientReportsService,
    updateConsultationService,
    updateDoctorProfileService,
} from "./doctors.service.js";

const notImplemented = (_request: Request, response: Response) => {
    response.status(501).json({ message: "Doctor queue endpoint not implemented" });
};

function getDoctorId(request: Request): string {
    const doctorId = request.tokenPayload?.userId;
    if (!doctorId) {
        throw new AppError("Doctor identity missing from token", 401);
    }
    return doctorId;
}

export async function login(request: Request, response: Response) {
    const parsed = doctorLoginSchema.parse(request.body);
    const result = await doctorLoginService(parsed);
    response.status(200).json(result);
}

export async function getMyProfile(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const profile = await getDoctorProfileService(doctorId);
    response.status(200).json(profile);
}

export async function updateMyProfile(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const parsed = updateDoctorProfileSchema.parse(request.body);
    const updated = await updateDoctorProfileService(doctorId, parsed);
    response.status(200).json(updated);
}

export async function getMySchedule(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const schedule = await getDoctorScheduleService(doctorId);
    response.status(200).json(schedule);
}

export async function getMyPatients(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const patients = await getDoctorPatientsService(doctorId);
    response.status(200).json(patients);
}

export async function getPatient(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const details = await getDoctorPatientDetailsService(doctorId, patientId);
    response.status(200).json(details);
}

export async function createConsultation(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const parsed = createConsultationSchema.parse(request.body);
    const consultation = await createConsultationService(doctorId, patientId, parsed);
    response.status(201).json(consultation);
}

export async function updateConsultation(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const { consultationId } = consultationIdParamSchema.parse(request.params);
    const parsed = updateConsultationSchema.parse(request.body);
    const updated = await updateConsultationService(doctorId, consultationId, parsed);
    response.status(200).json(updated);
}

export async function createInvestigationOrder(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const parsed = createInvestigationOrderSchema.parse(request.body);
    const order = await createInvestigationOrderService(doctorId, patientId, parsed);
    response.status(201).json(order);
}

export async function getPatientReports(request: Request, response: Response) {
    const doctorId = getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const reports = await getPatientReportsService(doctorId, patientId);
    response.status(200).json(reports);
}

// Queue endpoints intentionally left not implemented
export const getMyQueue = notImplemented;
export const completeQueueEntry = notImplemented;
export const skipQueueEntry = notImplemented;