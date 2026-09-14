import type { Request, Response } from "express";
import {
    generateInvoiceSchema,
    invoiceIdParamSchema,
    payInvoiceSchema,
    visitIdParamSchema,
} from "./billing.schema.js";
import {
    generateInvoiceService,
    getInvoiceByIdService,
    getInvoicesByVisitService,
    listInvoicesService,
    payInvoiceService,
} from "./billing.service.js";

export async function generateInvoice(request: Request, response: Response) {
    const { visitId } = visitIdParamSchema.parse(request.params);
    const parsed = generateInvoiceSchema.parse(request.body || {});
    const authUser = request.user || request.tokenPayload;
    const result = await generateInvoiceService(visitId, parsed, authUser);
    response.status(201).json(result);
}

export async function payInvoice(request: Request, response: Response) {
    const { id } = invoiceIdParamSchema.parse(request.params);
    const parsed = payInvoiceSchema.parse(request.body || {});
    const authUser = request.user || request.tokenPayload;
    const result = await payInvoiceService(id, parsed, authUser);
    response.status(200).json(result);
}

export async function getInvoiceById(request: Request, response: Response) {
    const { id } = invoiceIdParamSchema.parse(request.params);
    const result = await getInvoiceByIdService(id);
    response.status(200).json(result);
}

export async function getInvoicesByVisit(request: Request, response: Response) {
    const { visitId } = visitIdParamSchema.parse(request.params);
    const result = await getInvoicesByVisitService(visitId);
    response.status(200).json({ invoices: result });
}

export async function listInvoices(request: Request, response: Response) {
    const status = typeof request.query.status === "string" ? request.query.status : undefined;
    const result = await listInvoicesService(status);
    response.status(200).json({ invoices: result });
}
