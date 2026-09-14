import { Router } from "express";
import { authenticate, requireStaffRole } from "#middleware/auth.middleware.js";
import {
    addTaskDependency,
    completeWorkflowTask,
    createWorkflowTask,
    getTaskById,
    getVisitWorkflow,
    updateTaskStatus,
} from "./workflow.controller.js";

const router = Router();

router.use(authenticate);

router.post("/tasks", requireStaffRole(), createWorkflowTask);
router.get("/tasks/:taskId", getTaskById);
router.post("/tasks/:taskId/dependencies", requireStaffRole(), addTaskDependency);
router.patch("/tasks/:taskId/status", requireStaffRole(), updateTaskStatus);
router.post("/tasks/:taskId/complete", requireStaffRole(), completeWorkflowTask);
router.get("/visits/:visitId", getVisitWorkflow);

export default router;
