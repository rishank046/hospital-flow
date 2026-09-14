import type { Request, Response } from "express";
import { AppError } from "#utils/errorHandler.js";
import { resolveDoctorId } from "#modules/doctors/doctors.service.js";
import {
    joinQueueSchema,
    queueEntryIdParamSchema,
    queueFilterQuerySchema,
    requeueQueueSchema,
} from "./queue.schema.js";
import {
    callNextService,
    completeQueueEntryService,
    getMyDoctorQueueService,
    getMyPatientQueueStatusService,
    getQueueService,
    joinQueueService,
    requeueQueueEntryService,
    skipDoctorActiveEntryService,
    skipQueueEntryService,
    startServingService,
} from "./queue.service.js";

async function getDoctorId(request: Request): Promise<string> {
    const userId = request.user?.userId || request.tokenPayload?.userId;
    if (!userId) {
        throw new AppError("Authentication identity missing from token", 401);
    }
    return resolveDoctorId(userId);
}

export async function joinQueue(request: Request, response: Response) {
    const authUser = request.user || request.tokenPayload;
    const parsed = joinQueueSchema.parse(request.body);
    const result = await joinQueueService(parsed, authUser);
    response.status(201).json(result);
}

export async function getQueue(request: Request, response: Response) {
    const parsed = queueFilterQuerySchema.parse(request.query);
    const result = await getQueueService(parsed);
    response.status(200).json(result);
}

export async function callNext(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const result = await callNextService(doctorId);
    if (!result) {
        response.status(200).json({ message: "No patients waiting in queue", next: null });
        return;
    }
    response.status(200).json({ next: result });
}

export async function startServing(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const authUser = request.user || request.tokenPayload;
    const { queueEntryId } = queueEntryIdParamSchema.parse(request.params);
    const result = await startServingService(queueEntryId, doctorId, authUser);
    response.status(200).json(result);
}

export async function completeQueueEntry(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const { queueEntryId } = queueEntryIdParamSchema.parse(request.params);
    const result = await completeQueueEntryService(queueEntryId, doctorId);
    response.status(200).json(result);
}

export async function skipQueueEntry(request: Request, response: Response) {
    const authUser = request.user || request.tokenPayload;
    let doctorId: string | undefined;
    if (authUser?.role === "STAFF" && authUser.staffRole === "DOCTOR") {
        try {
            doctorId = await getDoctorId(request);
        } catch {
            // proceed as general staff
        }
    }
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
    const authUser = request.user || request.tokenPayload;
    let doctorId: string | undefined;
    if (authUser?.role === "STAFF" && authUser.staffRole === "DOCTOR") {
        try {
            doctorId = await getDoctorId(request);
        } catch {
            // proceed as general staff
        }
    }
    const { queueEntryId } = queueEntryIdParamSchema.parse(request.params);
    const parsed = requeueQueueSchema.parse(request.body || {});
    const result = await requeueQueueEntryService(queueEntryId, doctorId, authUser, parsed);
    response.status(200).json(result);
}

export async function getMyPatientQueue(request: Request, response: Response) {
    const userId = request.user?.userId || request.tokenPayload?.userId;
    if (!userId) {
        throw new AppError("Authentication identity missing", 401);
    }
    const result = await getMyPatientQueueStatusService(userId);
    response.status(200).json(result);
}

export async function getMyDoctorQueue(request: Request, response: Response) {
    const doctorId = await getDoctorId(request);
    const result = await getMyDoctorQueueService(doctorId);
    response.status(200).json(result);
}
