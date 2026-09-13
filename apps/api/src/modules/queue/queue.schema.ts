import { z } from "zod";

export const queueTypeEnum = z.enum([
    "APPOINTMENT",
    "WALK_IN",
    "EMERGENCY",
]);

export const queueStatusEnum = z.enum([
    "WAITING",
    "CALLED",
    "SERVING",
    "COMPLETED",
    "SKIPPED",
    "CANCELLED",
]);

export const joinQueueSchema = z.object({
    patientId: z.string().uuid(),
    doctorId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    appointmentId: z.string().uuid().optional(),
    type: queueTypeEnum.optional().default("WALK_IN"),
    priority: z.number().int().optional().default(0),
    scheduledTime: z.string().datetime().optional(),
});

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

export type JoinQueueInput = z.infer<typeof joinQueueSchema>;
export type UpdateQueueStatusInput = z.infer<typeof updateQueueStatusSchema>;
export type QueueFilterQuery = z.infer<typeof queueFilterQuerySchema>;
