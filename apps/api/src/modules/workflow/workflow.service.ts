import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import type {
    CreateWorkflowTaskInput,
    WorkflowTaskStatus,
    WorkflowTaskType,
} from "./workflow.schema.js";

export interface FormattedWorkflowTask {
    id: string;
    visitId: string;
    visit_id: string;
    taskType: WorkflowTaskType;
    task_type: WorkflowTaskType;
    status: WorkflowTaskStatus;
    priority: number;
    departmentId: string | null;
    department_id: string | null;
    assignedDoctorId: string | null;
    assigned_doctor_id: string | null;
    dependsOnTaskIds: string[];
    blockedByTaskIds: string[];
    isReady: boolean;
    createdAt: string;
    created_at: string;
    startedAt: string | null;
    started_at: string | null;
    completedAt: string | null;
    completed_at: string | null;
    updatedAt: string;
    updated_at: string;
}

export async function createWorkflowTaskService(
    data: CreateWorkflowTaskInput,
    _authUser?: AuthPayload
): Promise<FormattedWorkflowTask> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Verify visit exists
        const visitRes = await client.query(
            'SELECT id, status FROM "visits" WHERE id = $1',
            [data.visitId]
        );
        if (visitRes.rowCount === 0 || !visitRes.rows[0]) {
            throw new AppError("Visit not found", 404);
        }

        const dependsOn = data.dependsOnTaskIds || [];
        let initialStatus: WorkflowTaskStatus = "WAITING";

        if (dependsOn.length > 0) {
            // Verify dependencies belong to the same visit
            const depCheck = await client.query<{ id: string; status: string }>(
                'SELECT id, status FROM "workflow_tasks" WHERE id = ANY($1) AND visit_id = $2',
                [dependsOn, data.visitId]
            );

            if (depCheck.rowCount !== dependsOn.length) {
                throw new AppError(
                    "One or more prerequisite tasks do not exist or belong to another visit",
                    400
                );
            }

            // If any prerequisite is not COMPLETED, initial status is BLOCKED
            const hasUncompleted = depCheck.rows.some((r) => r.status !== "COMPLETED");
            if (hasUncompleted) {
                initialStatus = "BLOCKED";
            }
        }

        const taskInsert = await client.query(
            `INSERT INTO "workflow_tasks" (
                visit_id, task_type, status, priority, department_id, assigned_doctor_id
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                data.visitId,
                data.taskType,
                initialStatus,
                data.priority ?? 0,
                data.departmentId ?? null,
                data.assignedDoctorId ?? null,
            ]
        );

        const createdTask = taskInsert.rows[0];

        // Insert dependencies
        for (const depId of dependsOn) {
            await client.query(
                `INSERT INTO "workflow_task_dependencies" (task_id, depends_on_task_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [createdTask.id, depId]
            );
        }

        await client.query("COMMIT");
        return formatTask(createdTask, dependsOn, initialStatus === "BLOCKED" ? dependsOn : []);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function addTaskDependencyService(
    taskId: string,
    dependsOnTaskId: string
): Promise<{ taskId: string; dependsOnTaskId: string; taskStatus: WorkflowTaskStatus }> {
    if (taskId === dependsOnTaskId) {
        throw new AppError("A task cannot depend on itself", 400);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const tasksRes = await client.query<{ id: string; visit_id: string; status: WorkflowTaskStatus }>(
            'SELECT id, visit_id, status FROM "workflow_tasks" WHERE id IN ($1, $2)',
            [taskId, dependsOnTaskId]
        );

        if (tasksRes.rowCount !== 2) {
            throw new AppError("One or both tasks not found", 404);
        }

        const targetTask = tasksRes.rows.find((t) => t.id === taskId)!;
        const depTask = tasksRes.rows.find((t) => t.id === dependsOnTaskId)!;

        if (targetTask.visit_id !== depTask.visit_id) {
            throw new AppError("Tasks must belong to the same visit", 400);
        }

        // Circular dependency prevention
        const cycleCheck = await client.query(
            `WITH RECURSIVE dependency_chain AS (
                SELECT task_id, depends_on_task_id
                FROM "workflow_task_dependencies"
                WHERE task_id = $1
                UNION
                SELECT d.task_id, d.depends_on_task_id
                FROM "workflow_task_dependencies" d
                JOIN dependency_chain dc ON d.task_id = dc.depends_on_task_id
            )
            SELECT 1 FROM dependency_chain WHERE depends_on_task_id = $2`,
            [dependsOnTaskId, taskId]
        );

        if (cycleCheck.rowCount && cycleCheck.rowCount > 0) {
            throw new AppError("Circular dependency detected", 400);
        }

        await client.query(
            `INSERT INTO "workflow_task_dependencies" (task_id, depends_on_task_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [taskId, dependsOnTaskId]
        );

        let newStatus = targetTask.status;
        if (depTask.status !== "COMPLETED" && targetTask.status === "WAITING") {
            newStatus = "BLOCKED";
            await client.query(
                'UPDATE "workflow_tasks" SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newStatus, taskId]
            );
        }

        await client.query("COMMIT");
        return { taskId, dependsOnTaskId, taskStatus: newStatus };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function completeWorkflowTaskService(
    taskId: string,
    _authUser?: AuthPayload
): Promise<{
    completedTask: FormattedWorkflowTask;
    unblockedTasks: FormattedWorkflowTask[];
}> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const taskRes = await client.query(
            'SELECT * FROM "workflow_tasks" WHERE id = $1',
            [taskId]
        );

        if (taskRes.rowCount === 0 || !taskRes.rows[0]) {
            throw new AppError("Workflow task not found", 404);
        }

        const currentTask = taskRes.rows[0];

        if (currentTask.status === "COMPLETED") {
            throw new AppError("Task is already completed", 400);
        }

        if (currentTask.status === "CANCELLED") {
            throw new AppError("Cancelled task cannot be completed", 400);
        }

        if (currentTask.status === "BLOCKED") {
            throw new AppError("Cannot complete a BLOCKED task before prerequisites are met", 400);
        }

        // 1. Mark task completed
        const updateTask = await client.query(
            `UPDATE "workflow_tasks"
             SET status = 'COMPLETED',
                 completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [taskId]
        );

        const completedTaskRow = updateTask.rows[0];

        // 2. Find downstream tasks depending on this task
        const downstreamRes = await client.query<{ task_id: string }>(
            `SELECT DISTINCT d.task_id
             FROM "workflow_task_dependencies" d
             JOIN "workflow_tasks" t ON d.task_id = t.id
             WHERE d.depends_on_task_id = $1 AND t.status = 'BLOCKED'`,
            [taskId]
        );

        const unblockedRows: FormattedWorkflowTask[] = [];

        // 3. Atomically check each downstream task and unblock if all dependencies are complete
        for (const { task_id } of downstreamRes.rows) {
            const pendingDeps = await client.query(
                `SELECT COUNT(*)::int as count
                 FROM "workflow_task_dependencies" d
                 JOIN "workflow_tasks" t ON d.depends_on_task_id = t.id
                 WHERE d.task_id = $1 AND t.status != 'COMPLETED'`,
                [task_id]
            );

            const uncompletedCount = pendingDeps.rows[0]?.count ?? 0;
            if (uncompletedCount === 0) {
                // All dependencies complete! Unblock task atomically
                const unblockedRes = await client.query(
                    `UPDATE "workflow_tasks"
                     SET status = 'WAITING',
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                     RETURNING *`,
                    [task_id]
                );

                if (unblockedRes.rowCount && unblockedRes.rows[0]) {
                    unblockedRows.push(formatTask(unblockedRes.rows[0], [], []));
                }
            }
        }

        await client.query("COMMIT");

        return {
            completedTask: formatTask(completedTaskRow, [], []),
            unblockedTasks: unblockedRows,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function updateTaskStatusService(
    taskId: string,
    newStatus: WorkflowTaskStatus,
    authUser?: AuthPayload
): Promise<FormattedWorkflowTask> {
    if (newStatus === "COMPLETED") {
        const result = await completeWorkflowTaskService(taskId, authUser);
        return result.completedTask;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const taskRes = await client.query(
            'SELECT * FROM "workflow_tasks" WHERE id = $1',
            [taskId]
        );

        if (taskRes.rowCount === 0 || !taskRes.rows[0]) {
            throw new AppError("Workflow task not found", 404);
        }

        const task = taskRes.rows[0];

        if (task.status === "COMPLETED") {
            throw new AppError("Completed tasks cannot change status", 400);
        }

        if (task.status === "CANCELLED") {
            throw new AppError("Cancelled tasks cannot change status", 400);
        }

        // Validate illegal transitions
        if (task.status === "BLOCKED" && newStatus === "IN_PROGRESS") {
            throw new AppError("A BLOCKED task cannot start until dependencies are satisfied", 400);
        }

        let startedAtClause = "";
        const params: unknown[] = [newStatus, taskId];

        if (newStatus === "IN_PROGRESS" && !task.started_at) {
            startedAtClause = ", started_at = CURRENT_TIMESTAMP";
        }

        const updated = await client.query(
            `UPDATE "workflow_tasks"
             SET status = $1,
                 updated_at = CURRENT_TIMESTAMP
                 ${startedAtClause}
             WHERE id = $2
             RETURNING *`,
            params
        );

        await client.query("COMMIT");
        return formatTask(updated.rows[0], [], []);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getVisitWorkflowService(visitId: string): Promise<{
    tasks: FormattedWorkflowTask[];
    summary: {
        total: number;
        blocked: number;
        waiting: number;
        inProgress: number;
        completed: number;
        cancelled: number;
    };
}> {
    const tasksRes = await pool.query(
        `SELECT * FROM "workflow_tasks" WHERE visit_id = $1 ORDER BY created_at ASC`,
        [visitId]
    );

    const taskIds = tasksRes.rows.map((t) => t.id);
    let depsRows: Array<{ task_id: string; depends_on_task_id: string }> = [];

    if (taskIds.length > 0) {
        const depsRes = await pool.query<{ task_id: string; depends_on_task_id: string }>(
            `SELECT task_id, depends_on_task_id
             FROM "workflow_task_dependencies"
             WHERE task_id = ANY($1)`,
            [taskIds]
        );
        depsRows = depsRes.rows;
    }

    const taskStatusMap = new Map<string, string>();
    for (const t of tasksRes.rows) {
        taskStatusMap.set(t.id, t.status);
    }

    const formattedTasks: FormattedWorkflowTask[] = tasksRes.rows.map((t) => {
        const taskDeps = depsRows.filter((d) => d.task_id === t.id).map((d) => d.depends_on_task_id);
        const blockedBy = taskDeps.filter((depId) => taskStatusMap.get(depId) !== "COMPLETED");
        return formatTask(t, taskDeps, blockedBy);
    });

    const summary = {
        total: formattedTasks.length,
        blocked: formattedTasks.filter((t) => t.status === "BLOCKED").length,
        waiting: formattedTasks.filter((t) => t.status === "WAITING").length,
        inProgress: formattedTasks.filter((t) => t.status === "IN_PROGRESS").length,
        completed: formattedTasks.filter((t) => t.status === "COMPLETED").length,
        cancelled: formattedTasks.filter((t) => t.status === "CANCELLED").length,
    };

    return { tasks: formattedTasks, summary };
}

export async function getTaskByIdService(taskId: string): Promise<FormattedWorkflowTask> {
    const taskRes = await pool.query(
        'SELECT * FROM "workflow_tasks" WHERE id = $1',
        [taskId]
    );

    if (taskRes.rowCount === 0 || !taskRes.rows[0]) {
        throw new AppError("Workflow task not found", 404);
    }

    const task = taskRes.rows[0];
    const depsRes = await pool.query<{ depends_on_task_id: string; status: string }>(
        `SELECT d.depends_on_task_id, t.status
         FROM "workflow_task_dependencies" d
         JOIN "workflow_tasks" t ON d.depends_on_task_id = t.id
         WHERE d.task_id = $1`,
        [taskId]
    );

    const dependsOn = depsRes.rows.map((r) => r.depends_on_task_id);
    const blockedBy = depsRes.rows.filter((r) => r.status !== "COMPLETED").map((r) => r.depends_on_task_id);

    return formatTask(task, dependsOn, blockedBy);
}

function formatTask(
    row: Record<string, unknown>,
    dependsOn: string[],
    blockedBy: string[]
): FormattedWorkflowTask {
    const status = row.status as WorkflowTaskStatus;
    return {
        id: String(row.id),
        visitId: String(row.visit_id),
        visit_id: String(row.visit_id),
        taskType: row.task_type as WorkflowTaskType,
        task_type: row.task_type as WorkflowTaskType,
        status,
        priority: Number(row.priority ?? 0),
        departmentId: (row.department_id as string | null) ?? null,
        department_id: (row.department_id as string | null) ?? null,
        assignedDoctorId: (row.assigned_doctor_id as string | null) ?? null,
        assigned_doctor_id: (row.assigned_doctor_id as string | null) ?? null,
        dependsOnTaskIds: dependsOn,
        blockedByTaskIds: blockedBy,
        isReady: status === "WAITING" || status === "IN_PROGRESS",
        createdAt: new Date(String(row.created_at)).toISOString(),
        created_at: new Date(String(row.created_at)).toISOString(),
        startedAt: row.started_at ? new Date(String(row.started_at)).toISOString() : null,
        started_at: row.started_at ? new Date(String(row.started_at)).toISOString() : null,
        completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
        completed_at: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
        updatedAt: new Date(String(row.updated_at)).toISOString(),
        updated_at: new Date(String(row.updated_at)).toISOString(),
    };
}
