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
    reportUrl: z.string().optional().nullable(),
    report_url: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
    performedBy: z.string().uuid().optional().nullable(),
    performed_by: z.string().uuid().optional().nullable(),
    sampleCollectedAt: z.string().optional().nullable(),
    sample_collected_at: z.string().optional().nullable(),
});

export const recordSampleCollectionSchema = z.object({
    notes: z.string().optional().nullable(),
    sampleType: z.string().optional().nullable(),
    sample_type: z.string().optional().nullable(),
    collectedAt: z.string().optional().nullable(),
    collected_at: z.string().optional().nullable(),
});

export const uploadLabReportSchema = z.object({
    reportUrl: z.string().min(1).optional(),
    report_url: z.string().min(1).optional(),
    result: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
}).refine(data => Boolean(data.reportUrl || data.report_url), {
    message: "reportUrl (or report_url) is required",
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
export type RecordSampleCollectionInput = z.infer<typeof recordSampleCollectionSchema>;
export type UploadLabReportInput = z.infer<typeof uploadLabReportSchema>;
export type LabOrderFilterQuery = z.infer<typeof labOrderFilterQuerySchema>;
