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

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;
