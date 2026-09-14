import { z } from "zod";

export const invoiceItemInputSchema = z.object({
    description: z.string().min(1),
    itemType: z.string().optional().default("OTHER"),
    item_type: z.string().optional(),
    quantity: z.number().int().positive().optional().default(1),
    unitPrice: z.number().min(0).optional(),
    unit_price: z.number().min(0).optional(),
});

export const generateInvoiceSchema = z.object({
    items: z.array(invoiceItemInputSchema).optional(),
    notes: z.string().optional().nullable(),
});

export const payInvoiceSchema = z.object({
    paymentMethod: z.enum(["CASH", "CARD", "UPI", "INSURANCE", "NET_BANKING"]).optional().default("CASH"),
    amountPaid: z.number().min(0).optional(),
});

export const visitIdParamSchema = z.object({
    visitId: z.string().uuid(),
});

export const invoiceIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const enqueueCashQueueSchema = z.object({
    visitId: z.string().uuid().optional(),
    visit_id: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    priority: z.number().int().optional().default(0),
});

export const cashQueueEntryIdParamSchema = z.object({
    queueEntryId: z.string().uuid(),
});

export const payCashInvoiceSchema = z.object({
    invoiceId: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    amountReceived: z.number().min(0).optional(),
    amount_received: z.number().min(0).optional(),
    notes: z.string().optional().nullable(),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;
export type EnqueueCashQueueInput = z.infer<typeof enqueueCashQueueSchema>;
export type PayCashInvoiceInput = z.infer<typeof payCashInvoiceSchema>;
