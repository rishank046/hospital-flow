import { z } from "zod";

export const dispensePrescriptionSchema = z.object({
    quantity: z.number().int().positive().optional().default(1),
    notes: z.string().optional().nullable(),
});

export const prescriptionIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const prescriptionFilterQuerySchema = z.object({
    patientId: z.string().uuid().optional(),
    visitId: z.string().uuid().optional(),
    status: z.enum(["PENDING", "DISPENSED", "PARTIALLY_DISPENSED", "CANCELLED"]).optional(),
});

export type DispensePrescriptionInput = z.infer<typeof dispensePrescriptionSchema>;
export type PrescriptionFilterQuery = z.infer<typeof prescriptionFilterQuerySchema>;
