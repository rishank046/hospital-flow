import type { Request, Response } from "express";
import {
    addDependencySchema,
    createWorkflowTaskSchema,
    taskIdParamSchema,
    updateTaskStatusSchema,
    visitIdParamSchema,
} from "./workflow.schema.js";
import {
    addTaskDependencyService,
    completeWorkflowTaskService,
    createWorkflowTaskService,
    getTaskByIdService,
    getVisitWorkflowService,
    updateTaskStatusService,
} from "./workflow.service.js";

export async function createWorkflowTask(request: Request, response: Response) {
    const parsed = createWorkflowTaskSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const task = await createWorkflowTaskService(parsed, authUser);
    response.status(201).json(task);
}

export async function addTaskDependency(request: Request, response: Response) {
    const { taskId } = taskIdParamSchema.parse(request.params);
    const { dependsOnTaskId } = addDependencySchema.parse(request.body);
    const result = await addTaskDependencyService(taskId, dependsOnTaskId);
    response.status(200).json(result);
}

export async function updateTaskStatus(request: Request, response: Response) {
    const { taskId } = taskIdParamSchema.parse(request.params);
    const { status } = updateTaskStatusSchema.parse(request.body);
    const authUser = request.user || request.tokenPayload;
    const updated = await updateTaskStatusService(taskId, status, authUser);
    response.status(200).json(updated);
}

export async function completeWorkflowTask(request: Request, response: Response) {
    const { taskId } = taskIdParamSchema.parse(request.params);
    const authUser = request.user || request.tokenPayload;
    const result = await completeWorkflowTaskService(taskId, authUser);
    response.status(200).json(result);
}

export async function getVisitWorkflow(request: Request, response: Response) {
    const { visitId } = visitIdParamSchema.parse(request.params);
    const result = await getVisitWorkflowService(visitId);
    response.status(200).json(result);
}

export async function getTaskById(request: Request, response: Response) {
    const { taskId } = taskIdParamSchema.parse(request.params);
    const task = await getTaskByIdService(taskId);
    response.status(200).json(task);
}
