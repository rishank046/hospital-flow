import type { Request, Response } from "express";
import { resolveDoctorId } from "#modules/doctors/doctors.service.js";
import {
    createLabOrderSchema,
    labOrderFilterQuerySchema,
    labOrderIdParamSchema,
    patientIdParamSchema,
    recordSampleCollectionSchema,
    updateLabOrderSchema,
    uploadLabReportSchema,
} from "./lab-orders.schema.js";
import {
    createLabOrderService,
    getLabOrderByIdService,
    getLabOrdersService,
    getPatientReportsService,
    recordSampleCollectionService,
    updateLabOrderService,
    uploadLabReportService,
} from "./lab-orders.service.js";

export async function createLabOrder(request: Request, response: Response) {
    let doctorId: string | null = null;
    const userId = request.user?.userId || request.tokenPayload?.userId;
    if (userId) {
        try {
            doctorId = await resolveDoctorId(userId);
        } catch {
            // Not a doctor, or staff creating order
        }
    }

    const patientId = request.params.patientId || request.body.patientId || request.body.patient_id;
    const parsed = createLabOrderSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const result = await createLabOrderService(doctorId, patientId, parsed, authUser);
    response.status(201).json(result);
}

export async function getLabOrders(request: Request, response: Response) {
    const parsed = labOrderFilterQuerySchema.parse(request.query);
    const result = await getLabOrdersService(parsed);
    response.status(200).json({ orders: result });
}

export async function getLabOrderById(request: Request, response: Response) {
    const { id } = labOrderIdParamSchema.parse(request.params);
    const result = await getLabOrderByIdService(id);
    response.status(200).json(result);
}

export async function updateLabOrder(request: Request, response: Response) {
    const { id } = labOrderIdParamSchema.parse(request.params);
    const parsed = updateLabOrderSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const result = await updateLabOrderService(id, parsed, authUser);
    response.status(200).json(result);
}

export async function getPatientReports(request: Request, response: Response) {
    let doctorId = "";
    const userId = request.user?.userId || request.tokenPayload?.userId;
    if (userId) {
        try {
            doctorId = await resolveDoctorId(userId);
        } catch {
            // ignore
        }
    }
    const { patientId } = patientIdParamSchema.parse(request.params);
    const result = await getPatientReportsService(doctorId, patientId);
    response.status(200).json(result);
}

export async function recordSampleCollection(request: Request, response: Response) {
    const { id } = labOrderIdParamSchema.parse(request.params);
    const parsed = recordSampleCollectionSchema.parse(request.body || {});
    const authUser = request.user || request.tokenPayload;
    const result = await recordSampleCollectionService(id, parsed, authUser);
    response.status(200).json(result);
}

export async function uploadLabReport(request: Request, response: Response) {
    const { id } = labOrderIdParamSchema.parse(request.params);
    const parsed = uploadLabReportSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const result = await uploadLabReportService(id, parsed, authUser);
    response.status(200).json(result);
}
