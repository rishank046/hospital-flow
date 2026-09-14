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
    completeQueueEntryService,
    getMyDoctorQueueService,
    requeueQueueEntryService,
    skipDoctorActiveEntryService,
    skipQueueEntryService,
} from "#modules/queue/queue.service.js";
import { queueEntryIdParamSchema, requeueQueueSchema } from "#modules/queue/queue.schema.js";
import {
    createConsultationService,
    createInvestigationOrderService,
    doctorLoginService,
    getDoctorPatientDetailsService,
    getDoctorPatientsService,
    getDoctorProfileService,
    getDoctorScheduleService,
    getPatientReportsService,
    listPublicDoctorsService,
    resolveDoctorId,
    updateConsultationService,
    updateDoctorProfileService,
} from "./doctors.service.js";

const notImplemented = (_request: Request, response: Response) => {
    response.status(501).json({ message: "Doctor queue endpoint not implemented" });
};

async function getDoctorId(request: Request): Promise<string> {
    const userId = request.user?.userId || request.tokenPayload?.userId;
    if (!userId) {
        throw new AppError("Doctor identity missing from token", 401);
    }
    return resolveDoctorId(userId);
}

export async function login(request: Request, response: Response) {
    const parsed = doctorLoginSchema.parse(request.body);
    const result = await doctorLoginService(parsed);
    response.status(200).json(result);
}

export async function listDoctors(_request: Request, response: Response) {
    const result = await listPublicDoctorsService();
    response.status(200).json(result);
}

export async function getDoctorById(request: Request, response: Response) {
    const doctorId = String(request.params.doctorId);
    const profile = await getDoctorProfileService(doctorId);
    response.status(200).json(profile);
}

export async function getMyProfile(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const profile = await getDoctorProfileService(doctorId);
    response.status(200).json(profile);
}

export async function updateMyProfile(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const parsed = updateDoctorProfileSchema.parse(request.body);
    const updated = await updateDoctorProfileService(doctorId, parsed);
    response.status(200).json(updated);
}

export async function getMySchedule(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const schedule = await getDoctorScheduleService(doctorId);
    response.status(200).json(schedule);
}

export async function getMyPatients(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const patients = await getDoctorPatientsService(doctorId);
    response.status(200).json(patients);
}

export async function getPatient(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const details = await getDoctorPatientDetailsService(doctorId, patientId);
    response.status(200).json(details);
}

export async function createConsultation(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const parsed = createConsultationSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const consultation = await createConsultationService(doctorId, patientId, parsed, authUser);
    response.status(201).json(consultation);
}

export async function updateConsultation(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { consultationId } = consultationIdParamSchema.parse(request.params);
    const parsed = updateConsultationSchema.parse(request.body);
    const updated = await updateConsultationService(doctorId, consultationId, parsed);
    response.status(200).json(updated);
}

export async function createInvestigationOrder(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const parsed = createInvestigationOrderSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const order = await createInvestigationOrderService(doctorId, patientId, parsed, authUser);
    response.status(201).json(order);
}

export async function getPatientReports(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const reports = await getPatientReportsService(doctorId, patientId);
    response.status(200).json(reports);
}

export async function getMyQueue(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const queue = await getMyDoctorQueueService(doctorId);
    response.status(200).json(queue);
}

export async function completeQueueEntry(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { queueEntryId } = queueEntryIdParamSchema.parse(request.params);
    const result = await completeQueueEntryService(queueEntryId, doctorId);
    response.status(200).json(result);
}

export async function skipQueueEntry(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { queueEntryId } = queueEntryIdParamSchema.parse(request.params);
    const result = await skipQueueEntryService(queueEntryId, doctorId);
    response.status(200).json(result);
}

export async function skipDoctorActive(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const result = await skipDoctorActiveEntryService(doctorId);
    response.status(200).json(result);
}

export async function requeueQueueEntry(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { queueEntryId } = queueEntryIdParamSchema.parse(request.params);
    const authUser = request.user || request.tokenPayload;
    const parsed = requeueQueueSchema.parse(request.body || {});
    const result = await requeueQueueEntryService(queueEntryId, doctorId, authUser, parsed);
    response.status(200).json(result);
}