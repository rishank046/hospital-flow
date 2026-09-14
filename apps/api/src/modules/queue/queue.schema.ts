import { z } from "zod";

export const queueTypeEnum = z.enum([
    "APPOINTMENT",
    "WALKIN",
    "WALK_IN",
    "EMERGENCY",
    "DIAGNOSTICS",
    "PHARMACY",
    "BILLING",
    "CASH_COUNTER",
]);

export const queueStatusEnum = z.enum([
    "WAITING",
    "CALLED",
    "IN_PROGRESS",
    "SERVING",
    "COMPLETED",
    "SKIPPED",
    "CANCELLED",
]);

export const joinQueueSchema = z
    .object({
        visitId: z.string().uuid().optional(),
        visit_id: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        patient_id: z.string().uuid().optional(),
        doctorId: z.string().uuid().optional(),
        doctor_id: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        department_id: z.string().uuid().optional(),
        appointmentId: z.string().uuid().optional(),
        appointment_id: z.string().uuid().optional(),
        type: queueTypeEnum.optional().default("WALK_IN"),
        priority: z.number().int().optional().default(0),
        scheduledTime: z.string().datetime().optional(),
        scheduled_time: z.string().datetime().optional(),
    })
    .refine(
        (data) => Boolean(data.visitId || data.visit_id || data.patientId || data.patient_id),
        {
            message: "Either visitId (or visit_id) or patientId (or patient_id) must be provided",
        }
    );

export const updateQueueStatusSchema = z.object({
    status: queueStatusEnum,
});

export const queueEntryIdParamSchema = z.object({
    queueEntryId: z.string().uuid(),
});

export const queueFilterQuerySchema = z.object({
    doctorId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    status: queueStatusEnum.optional(),
});

export const requeueQueueSchema = z.object({
    strategy: z.enum(["fair", "top", "end"]).optional().default("fair"),
    priority: z.number().int().optional(),
});

export type JoinQueueInput = z.infer<typeof joinQueueSchema>;
export type UpdateQueueStatusInput = z.infer<typeof updateQueueStatusSchema>;
export type QueueFilterQuery = z.infer<typeof queueFilterQuerySchema>;
export type RequeueQueueInput = z.infer<typeof requeueQueueSchema>;
