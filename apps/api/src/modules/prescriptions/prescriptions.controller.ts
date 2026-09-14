import type { Request, Response } from "express";
import {
    dispensePrescriptionSchema,
    prescriptionFilterQuerySchema,
    prescriptionIdParamSchema,
} from "./prescriptions.schema.js";
import {
    dispensePrescriptionService,
    getPrescriptionByIdService,
    getPrescriptionsService,
} from "./prescriptions.service.js";

export async function dispensePrescription(request: Request, response: Response) {
    const { id } = prescriptionIdParamSchema.parse(request.params);
    const parsed = dispensePrescriptionSchema.parse(request.body || {});
    const authUser = request.user || request.tokenPayload;
    const result = await dispensePrescriptionService(id, parsed, authUser);
    response.status(200).json(result);
}

export async function getPrescriptions(request: Request, response: Response) {
    const parsed = prescriptionFilterQuerySchema.parse(request.query);
    const result = await getPrescriptionsService(parsed);
    response.status(200).json({ prescriptions: result });
}

export async function getPrescriptionById(request: Request, response: Response) {
    const { id } = prescriptionIdParamSchema.parse(request.params);
    const result = await getPrescriptionByIdService(id);
    response.status(200).json(result);
}
