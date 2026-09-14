import type { Request, Response } from "express";
import { recordVitalsSchema, visitIdParamSchema, vitalsIdParamSchema } from "./vitals.schema.js";
import { getVitalsByIdService, getVitalsByVisitService, recordVitalsService } from "./vitals.service.js";

export async function recordVitals(request: Request, response: Response) {
    const { visitId } = visitIdParamSchema.parse(request.params);
    const parsed = recordVitalsSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const result = await recordVitalsService(visitId, parsed, authUser);
    response.status(201).json(result);
}

export async function getVitalsByVisit(request: Request, response: Response) {
    const { visitId } = visitIdParamSchema.parse(request.params);
    const result = await getVitalsByVisitService(visitId);
    response.status(200).json({ vitals: result });
}

export async function getVitalsById(request: Request, response: Response) {
    const { id } = vitalsIdParamSchema.parse(request.params);
    const result = await getVitalsByIdService(id);
    response.status(200).json(result);
}
