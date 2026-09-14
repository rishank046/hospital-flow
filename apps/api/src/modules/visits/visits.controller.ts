import type { Request, Response } from "express";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import {
    createVisitSchema,
    updateVisitStatusSchema,
    visitIdParamSchema,
} from "./visits.schema.js";
import {
    createVisitService,
    getCurrentPatientVisitService,
    getVisitByIdService,
    listVisitsService,
    updateVisitStatusService,
} from "./visits.service.js";

function getAuthUser(request: Request): AuthPayload {
    const user = request.user || request.tokenPayload;
    if (!user) {
        throw new AppError("Authentication required", 401);
    }
    return user;
}

export async function createVisit(request: Request, response: Response) {
    const authUser = getAuthUser(request);
    const parsed = createVisitSchema.parse(request.body);
    const visit = await createVisitService(parsed, authUser);
    response.status(201).json(visit);
}

export async function getVisitById(request: Request, response: Response) {
    const authUser = getAuthUser(request);
    const { id } = visitIdParamSchema.parse(request.params);
    const visit = await getVisitByIdService(id, authUser);
    response.status(200).json(visit);
}

export async function getCurrentPatientVisit(request: Request, response: Response) {
    const authUser = getAuthUser(request);
    const visit = await getCurrentPatientVisitService(authUser.userId);
    response.status(200).json(visit);
}

export async function updateVisitStatus(request: Request, response: Response) {
    const authUser = getAuthUser(request);
    const { id } = visitIdParamSchema.parse(request.params);
    const { status } = updateVisitStatusSchema.parse(request.body);
    const updated = await updateVisitStatusService(id, status, authUser);
    response.status(200).json(updated);
}

export async function listVisits(request: Request, response: Response) {
    const authUser = getAuthUser(request);
    const status = request.query.status as string | undefined;
    const visits = await listVisitsService(status, authUser);
    response.status(200).json({ visits });
}
