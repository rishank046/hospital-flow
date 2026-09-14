import type { Request, Response } from "express";
import { resolveDoctorId } from "#modules/doctors/doctors.service.js";
import { AppError } from "#utils/errorHandler.js";
import {
    consultationIdParamSchema,
    createConsultationSchema,
    patientIdParamSchema,
    updateConsultationSchema,
} from "./consultations.schema.js";
import {
    createConsultationService,
    getConsultationByIdService,
    updateConsultationService,
} from "./consultations.service.js";

async function getDoctorId(request: Request): Promise<string> {
    const userId = request.user?.userId || request.tokenPayload?.userId;
    if (!userId) {
        throw new AppError("Authentication identity missing from token", 401);
    }
    return resolveDoctorId(userId);
}

export async function createConsultation(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { patientId } = patientIdParamSchema.parse(request.params);
    const parsed = createConsultationSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const result = await createConsultationService(doctorId, patientId, parsed, authUser);
    response.status(201).json(result);
}

export async function updateConsultation(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { consultationId } = consultationIdParamSchema.parse(request.params);
    const parsed = updateConsultationSchema.parse(request.body);
    const result = await updateConsultationService(doctorId, consultationId, parsed);
    response.status(200).json(result);
}

export async function getConsultationById(request: Request, response: Response) {
    const { consultationId } = consultationIdParamSchema.parse(request.params);
    const result = await getConsultationByIdService(consultationId);
    response.status(200).json(result);
}
