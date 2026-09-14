import { z } from "zod";

export const workflowTaskTypeEnum = z.enum([
    "CONSULTATION",
    "LAB_TEST",
    "PHARMACY",
    "BILLING",
]);

export const workflowTaskStatusEnum = z.enum([
    "BLOCKED",
    "WAITING",
    "IN_PROGRESS",
    "COMPLETED",
    "SKIPPED",
    "CANCELLED",
]);

export type WorkflowTaskType = z.infer<typeof workflowTaskTypeEnum>;
export type WorkflowTaskStatus = z.infer<typeof workflowTaskStatusEnum>;

export const createWorkflowTaskSchema = z.object({
    visitId: z.string().uuid(),
    taskType: workflowTaskTypeEnum,
    priority: z.number().int().optional().default(0),
    departmentId: z.string().uuid().optional().nullable(),
    assignedDoctorId: z.string().uuid().optional().nullable(),
    dependsOnTaskIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreateWorkflowTaskInput = z.infer<typeof createWorkflowTaskSchema>;

export const addDependencySchema = z.object({
    dependsOnTaskId: z.string().uuid(),
});

export type AddDependencyInput = z.infer<typeof addDependencySchema>;

export const updateTaskStatusSchema = z.object({
    status: workflowTaskStatusEnum,
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export const taskIdParamSchema = z.object({
    taskId: z.string().uuid(),
});

export const visitIdParamSchema = z.object({
    visitId: z.string().uuid(),
});
