import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { createVisitService } from "#modules/visits/visits.service.js";
import { completeWorkflowTaskService } from "#modules/workflow/workflow.service.js";
import type {
    CreateLabOrderInput,
    LabOrderFilterQuery,
    RecordSampleCollectionInput,
    UpdateLabOrderInput,
    UploadLabReportInput,
} from "./lab-orders.schema.js";

export async function createLabOrderService(
    doctorId: string | null,
    patientId: string,
    data: CreateLabOrderInput,
    authUser?: AuthPayload
) {
    const patientRes = await pool.query<{ id: string; user_id: string }>(
        'SELECT id, owner_user_id as user_id FROM "patient_profiles" WHERE id = $1',
        [patientId]
    );
    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient not found", 404);
    }

    let visitId = data.visitId || data.visit_id || null;
    const testName = (data.testName || data.test_name)!;
    const resolvedDoctorId = doctorId || data.doctorId || data.doctor_id || null;

    // Derive visit if not provided
    if (!visitId) {
        const vRes = await pool.query<{ id: string }>(
            'SELECT id FROM "visits" WHERE patient_id = $1 AND status NOT IN (\'COMPLETED\', \'CANCELLED\') ORDER BY created_at DESC LIMIT 1',
            [patientId]
        );
        if (vRes.rowCount && vRes.rows[0]) {
            visitId = vRes.rows[0].id;
        }
    }

    if (!visitId) {
        let validUserId = patientRes.rows[0].user_id;
        if (authUser?.userId) {
            const userCheck = await pool.query<{ id: string }>(
                'SELECT id FROM "users" WHERE id = $1',
                [authUser.userId]
            );
            if (userCheck.rowCount) {
                validUserId = authUser.userId;
            }
        }

        // The authenticated staff member is creating the visit on behalf of
        // the patient (clinical workflow), so act as STAFF to bypass the
        // patient-ownership check in createVisitService.
        const callerAuth: AuthPayload = {
            userId: authUser?.userId || validUserId || "system",
            email: authUser?.email || "system@hospital.internal",
            role: "STAFF",
        };

        const createdVisit = await createVisitService(
            {
                patientId,
                visitType: "WALKIN",
                assignedDoctorId: resolvedDoctorId,
                departmentId: null,
                appointmentId: null,
                registeredBy: authUser?.userId ?? null,
            },
            callerAuth
        );
        visitId = createdVisit.id;
    }

    // investigation_orders.doctor_id is NOT NULL in the schema. When the
    // order is created by non-doctor staff (e.g. a nurse), fall back to the
    // visit's assigned doctor so the FK constraint is always satisfied.
    let orderDoctorId = resolvedDoctorId;
    if (!orderDoctorId) {
        const visitDocRes = await pool.query<{ assigned_doctor_id: string | null }>(
            'SELECT assigned_doctor_id FROM "visits" WHERE id = $1',
            [visitId]
        );
        orderDoctorId = visitDocRes.rows[0]?.assigned_doctor_id ?? null;
    }
    if (!orderDoctorId) {
        throw new AppError("A doctor is required to create an investigation order", 400);
    }

    const orderRes = await pool.query(
        `INSERT INTO "investigation_orders" (
            doctor_id,
            visit_id,
            test_name,
            instructions,
            status
         )
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING *`,
        [
            orderDoctorId,
            visitId,
            testName,
            data.instructions ?? null,
        ]
    );

    return {
        ...orderRes.rows[0],
        patient_id: patientId,
        patientId,
    };
}

export async function getLabOrdersService(filter: LabOrderFilterQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.patientId) {
        params.push(filter.patientId);
        conditions.push(`v.patient_id = $${params.length}`);
    }

    if (filter.visitId) {
        params.push(filter.visitId);
        conditions.push(`io.visit_id = $${params.length}`);
    }

    if (filter.doctorId) {
        params.push(filter.doctorId);
        conditions.push(`io.doctor_id = $${params.length}`);
    }

    if (filter.status) {
        params.push(filter.status);
        conditions.push(`io.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            io.*,
            v.patient_id,
            p.name as patient_name,
            u.name as doctor_name,
            tech_u.name as performed_by_name
        FROM "investigation_orders" io
        JOIN "visits" v ON io.visit_id = v.id
        JOIN "patient_profiles" p ON v.patient_id = p.id
        LEFT JOIN "doctors" d ON io.doctor_id = d.id
        LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
        LEFT JOIN "users" u ON s.user_id = u.id
        LEFT JOIN "staff_profiles" tech ON io.performed_by = tech.id
        LEFT JOIN "users" tech_u ON tech.user_id = tech_u.id
        ${whereClause}
        ORDER BY io.created_at DESC
    `;

    const res = await pool.query(query, params);
    return res.rows;
}

export async function getLabOrderByIdService(id: string) {
    const res = await pool.query(
        `SELECT 
            io.*,
            v.patient_id,
            p.name as patient_name,
            u.name as doctor_name,
            tech_u.name as performed_by_name
         FROM "investigation_orders" io
         JOIN "visits" v ON io.visit_id = v.id
         JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "doctors" d ON io.doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" u ON s.user_id = u.id
         LEFT JOIN "staff_profiles" tech ON io.performed_by = tech.id
         LEFT JOIN "users" tech_u ON tech.user_id = tech_u.id
         WHERE io.id = $1`,
        [id]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Investigation order not found", 404);
    }

    return res.rows[0];
}

export async function updateLabOrderService(
    orderId: string,
    data: UpdateLabOrderInput,
    authUser?: AuthPayload
) {
    const checkRes = await pool.query<{ id: string; status: string; visit_id: string }>(
        'SELECT id, status, visit_id FROM "investigation_orders" WHERE id = $1',
        [orderId]
    );

    if (checkRes.rowCount === 0 || !checkRes.rows[0]) {
        throw new AppError("Investigation order not found", 404);
    }

    let performedByStaffId: string | null = null;
    const performedBy = data.performedBy || data.performed_by || authUser?.userId;
    if (performedBy) {
        const staffLookup = await pool.query<{ id: string }>(
            'SELECT id FROM "staff_profiles" WHERE user_id = $1 OR id = $1',
            [performedBy]
        );
        if (staffLookup.rowCount && staffLookup.rows[0]) {
            performedByStaffId = staffLookup.rows[0].id;
        }
    }

    const newStatus = data.status ?? "COMPLETED";
    const resultText = data.result ?? null;
    const reportUrl = data.reportUrl || data.report_url || null;
    const rawSampleTime = data.sampleCollectedAt || data.sample_collected_at;
    const sampleTime = rawSampleTime ? new Date(rawSampleTime) : null;

    const updates: string[] = [
        "status = $1",
        "result = COALESCE($2, result)",
        "performed_by = COALESCE($3, performed_by)",
        "report_url = COALESCE($4, report_url)",
        "updated_at = CURRENT_TIMESTAMP",
    ];
    const params: unknown[] = [newStatus, resultText, performedByStaffId, reportUrl];

    if (sampleTime) {
        params.push(sampleTime);
        updates.push(`sample_collected_at = $${params.length}`);
    } else if (newStatus === "SAMPLE_COLLECTED") {
        updates.push("sample_collected_at = COALESCE(sample_collected_at, CURRENT_TIMESTAMP)");
    }

    if (newStatus === "COMPLETED") {
        updates.push("resulted_at = COALESCE(resulted_at, CURRENT_TIMESTAMP)");
    }

    params.push(orderId);
    const whereParamIndex = params.length;

    const updateRes = await pool.query(
        `UPDATE "investigation_orders"
         SET ${updates.join(", ")}
         WHERE id = $${whereParamIndex}
         RETURNING *`,
        params
    );

    const updatedOrder = updateRes.rows[0];

    // If order was completed, also complete any active LAB_TEST workflow task for this visit
    if (newStatus === "COMPLETED" && checkRes.rows[0].visit_id) {
        try {
            const wfRes = await pool.query<{ id: string }>(
                `SELECT id FROM "workflow_tasks"
                 WHERE visit_id = $1 AND task_type = 'LAB_TEST' AND status NOT IN ('COMPLETED', 'CANCELLED', 'SKIPPED')
                 LIMIT 1`,
                [checkRes.rows[0].visit_id]
            );
            if (wfRes.rowCount && wfRes.rows[0]) {
                await completeWorkflowTaskService(wfRes.rows[0].id, authUser);
            }
        } catch {
            // Workflow unblock is best-effort alongside order completion
        }
    }

    return updatedOrder;
}

export async function recordSampleCollectionService(
    orderId: string,
    data?: RecordSampleCollectionInput,
    authUser?: AuthPayload
) {
    const checkRes = await pool.query<{ id: string; status: string; visit_id: string }>(
        'SELECT id, status, visit_id FROM "investigation_orders" WHERE id = $1',
        [orderId]
    );

    if (checkRes.rowCount === 0 || !checkRes.rows[0]) {
        throw new AppError("Investigation order not found", 404);
    }

    let staffId: string | null = null;
    if (authUser?.userId) {
        const staffRes = await pool.query<{ id: string }>(
            'SELECT id FROM "staff_profiles" WHERE user_id = $1 OR id = $1',
            [authUser.userId]
        );
        if (staffRes.rowCount && staffRes.rows[0]) {
            staffId = staffRes.rows[0].id;
        }
    }

    const collectedAt = data?.collectedAt || data?.collected_at ? new Date(data?.collectedAt || data?.collected_at!) : new Date();

    const updateRes = await pool.query(
        `UPDATE "investigation_orders"
         SET status = 'SAMPLE_COLLECTED',
             sample_collected_at = $1,
             performed_by = COALESCE($2, performed_by),
             instructions = CASE
                 WHEN $3::text IS NOT NULL THEN COALESCE(instructions || ' | Notes: ' || $3, $3)
                 ELSE instructions
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [collectedAt, staffId, data?.notes ?? null, orderId]
    );

    return {
        ...updateRes.rows[0],
        message: "Sample collected successfully",
    };
}

export async function uploadLabReportService(
    orderId: string,
    data: UploadLabReportInput,
    authUser?: AuthPayload
) {
    const reportUrl = data.reportUrl || data.report_url;
    if (!reportUrl) {
        throw new AppError("reportUrl is required", 400);
    }

    const checkRes = await pool.query<{ id: string; status: string; visit_id: string }>(
        'SELECT id, status, visit_id FROM "investigation_orders" WHERE id = $1',
        [orderId]
    );

    if (checkRes.rowCount === 0 || !checkRes.rows[0]) {
        throw new AppError("Investigation order not found", 404);
    }

    let staffId: string | null = null;
    if (authUser?.userId) {
        const staffRes = await pool.query<{ id: string }>(
            'SELECT id FROM "staff_profiles" WHERE user_id = $1 OR id = $1',
            [authUser.userId]
        );
        if (staffRes.rowCount && staffRes.rows[0]) {
            staffId = staffRes.rows[0].id;
        }
    }

    const resultText = data.result ?? (data.notes ? `Report uploaded: ${reportUrl} (${data.notes})` : `Report uploaded: ${reportUrl}`);

    const updateRes = await pool.query(
        `UPDATE "investigation_orders"
         SET status = 'COMPLETED',
             report_url = $1,
             result = COALESCE($2, result),
             performed_by = COALESCE($3, performed_by),
             resulted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [reportUrl, resultText, staffId, orderId]
    );

    // Unblock linked LAB_TEST workflow task
    if (checkRes.rows[0].visit_id) {
        try {
            const wfRes = await pool.query<{ id: string }>(
                `SELECT id FROM "workflow_tasks"
                 WHERE visit_id = $1 AND task_type = 'LAB_TEST' AND status NOT IN ('COMPLETED', 'CANCELLED', 'SKIPPED')
                 LIMIT 1`,
                [checkRes.rows[0].visit_id]
            );
            if (wfRes.rowCount && wfRes.rows[0]) {
                await completeWorkflowTaskService(wfRes.rows[0].id, authUser);
            }
        } catch {
            // Best effort workflow unblock
        }
    }

    return {
        ...updateRes.rows[0],
        message: "Lab report uploaded and marked completed successfully",
    };
}

export async function getPatientReportsService(doctorIdOrPatientId: string, maybePatientId?: string) {
    const patientId = maybePatientId ?? doctorIdOrPatientId;
    const res = await pool.query(
        `SELECT 
            io.*,
            v.patient_id,
            p.name as patient_name,
            u.name as doctor_name,
            tech_u.name as performed_by_name
         FROM "investigation_orders" io
         JOIN "visits" v ON io.visit_id = v.id
         JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "doctors" d ON io.doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" u ON s.user_id = u.id
         LEFT JOIN "staff_profiles" tech ON io.performed_by = tech.id
         LEFT JOIN "users" tech_u ON tech.user_id = tech_u.id
         WHERE v.patient_id = $1
         ORDER BY io.created_at DESC`,
        [patientId]
    );
    return { reports: res.rows };
}

export { createLabOrderService as createInvestigationOrderService };
