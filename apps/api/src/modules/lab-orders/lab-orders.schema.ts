import { z } from "zod";

export const labOrderStatusEnum = z.enum([
    "PENDING",
    "SAMPLE_COLLECTED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
]);

export const createLabOrderSchema = z.object({
    patientId: z.string().uuid().optional(),
    patient_id: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    doctor_id: z.string().uuid().optional(),
    visitId: z.string().uuid().optional(),
    visit_id: z.string().uuid().optional(),
    testName: z.string().min(1, "Test name is required").optional(),
    test_name: z.string().min(1, "Test name is required").optional(),
    instructions: z.string().optional().nullable(),
}).refine(
    (data) => Boolean(data.testName || data.test_name),
    { message: "testName (or test_name) is required" }
);

export const updateLabOrderSchema = z.object({
    status: labOrderStatusEnum.optional(),
    result: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
    performedBy: z.string().uuid().optional().nullable(),
    performed_by: z.string().uuid().optional().nullable(),
});

export const labOrderIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.string().uuid(),
});

export const labOrderFilterQuerySchema = z.object({
    patientId: z.string().uuid().optional(),
    visitId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    status: labOrderStatusEnum.optional(),
});

export type CreateLabOrderInput = z.infer<typeof createLabOrderSchema>;
export type UpdateLabOrderInput = z.infer<typeof updateLabOrderSchema>;
export type LabOrderFilterQuery = z.infer<typeof labOrderFilterQuerySchema>;
