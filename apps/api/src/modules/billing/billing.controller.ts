import type { Request, Response } from "express";
import {
    cashQueueEntryIdParamSchema,
    enqueueCashQueueSchema,
    generateInvoiceSchema,
    invoiceIdParamSchema,
    payCashInvoiceSchema,
    payInvoiceSchema,
    visitIdParamSchema,
} from "./billing.schema.js";
import {
    callNextCashCounterService,
    enqueueCashCounterService,
    getCashCounterQueueService,
    generateInvoiceService,
    getInvoiceByIdService,
    getInvoicesByVisitService,
    listInvoicesService,
    payCashInvoiceService,
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

export async function enqueueCashCounter(request: Request, response: Response) {
    const parsed = enqueueCashQueueSchema.parse(request.body || {});
    const authUser = request.user || request.tokenPayload;
    const result = await enqueueCashCounterService(parsed, authUser);
    response.status(201).json(result);
}

export async function getCashCounterQueue(request: Request, response: Response) {
    const result = await getCashCounterQueueService();
    response.status(200).json(result);
}

export async function callNextCashCounter(request: Request, response: Response) {
    const result = await callNextCashCounterService();
    if (!result) {
        response.status(200).json({ message: "No patients waiting at cash counter", next: null });
        return;
    }
    response.status(200).json({ next: result });
}

export async function payCashInvoice(request: Request, response: Response) {
    const { queueEntryId } = cashQueueEntryIdParamSchema.parse(request.params);
    const parsed = payCashInvoiceSchema.parse(request.body || {});
    const authUser = request.user || request.tokenPayload;
    const result = await payCashInvoiceService(queueEntryId, parsed, authUser);
    response.status(200).json(result);
}

