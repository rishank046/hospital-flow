import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { completeWorkflowTaskService } from "#modules/workflow/workflow.service.js";
import type { DispensePrescriptionInput, PrescriptionFilterQuery } from "./prescriptions.schema.js";

export async function dispensePrescriptionService(
    prescriptionId: string,
    data: DispensePrescriptionInput,
    authUser?: AuthPayload
) {
    const prescRes = await pool.query(
        'SELECT * FROM "prescriptions" WHERE id = $1',
        [prescriptionId]
    );

    if (prescRes.rowCount === 0 || !prescRes.rows[0]) {
        throw new AppError("Prescription not found", 404);
    }

    const presc = prescRes.rows[0];
    const visitId = presc.visit_id;

    // DEPENDENCY GATING: Ensure lab investigations are completed before dispensing
    if (!data.force && visitId) {
        const pendingLabs = await pool.query<{ id: string; test_name: string; status: string }>(
            `SELECT id, test_name, status
             FROM "investigation_orders"
             WHERE visit_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
            [visitId]
        );

        const pendingLabTasks = await pool.query<{ id: string; status: string }>(
            `SELECT id, status
             FROM "workflow_tasks"
             WHERE visit_id = $1 AND task_type = 'LAB_TEST' AND status NOT IN ('COMPLETED', 'CANCELLED', 'SKIPPED')`,
            [visitId]
        );

        if (pendingLabs.rowCount! > 0 || pendingLabTasks.rowCount! > 0) {
            const pendingNames = pendingLabs.rows.map((r) => r.test_name).filter(Boolean);
            const detail = pendingNames.length > 0 ? ` (${pendingNames.join(", ")})` : "";
            throw new AppError(
                `Cannot dispense medication: pending lab investigation(s) must be completed first${detail}`,
                400
            );
        }
    }

    const quantity = String(data.quantity ?? 1);
    let dispensedByStaffId: string | null = null;
    if (authUser?.userId) {
        const staffLookup = await pool.query<{ id: string }>(
            'SELECT id FROM "staff_profiles" WHERE user_id = $1 OR id = $1',
            [authUser.userId]
        );
        if (staffLookup.rowCount && staffLookup.rows[0]) {
            dispensedByStaffId = staffLookup.rows[0].id;
        }
    }

    const dispenseRes = await pool.query(
        `INSERT INTO "pharmacy_dispenses" (prescription_id, dispensed_by, quantity, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [prescriptionId, dispensedByStaffId, quantity, data.notes ?? null]
    );

    const updateRes = await pool.query(
        `UPDATE "prescriptions"
         SET status = 'DISPENSED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [prescriptionId]
    );

    // Atomically unblock / complete PHARMACY_DISPENSE workflow task if one exists for this visit
    if (visitId) {
        try {
            const wfRes = await pool.query<{ id: string }>(
                `SELECT id FROM "workflow_tasks"
                 WHERE visit_id = $1 AND task_type = 'PHARMACY_DISPENSE' AND status NOT IN ('COMPLETED', 'CANCELLED', 'SKIPPED')
                 LIMIT 1`,
                [visitId]
            );
            if (wfRes.rowCount && wfRes.rows[0]) {
                await completeWorkflowTaskService(wfRes.rows[0].id, authUser);
            }
        } catch {
            // Workflow unblock is best-effort
        }
    }

    return {
        prescription: updateRes.rows[0],
        dispense: {
            ...dispenseRes.rows[0],
            dispensed_quantity: Number(dispenseRes.rows[0].quantity) || 1,
        },
    };
}

export async function getPrescriptionsService(filter: PrescriptionFilterQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.patientId) {
        params.push(filter.patientId);
        conditions.push(`v.patient_id = $${params.length}`);
    }

    if (filter.visitId) {
        params.push(filter.visitId);
        conditions.push(`pr.visit_id = $${params.length}`);
    }

    if (filter.status) {
        params.push(filter.status);
        conditions.push(`pr.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            pr.*,
            v.patient_id,
            p.name as patient_name,
            u.name as doctor_name
        FROM "prescriptions" pr
        JOIN "visits" v ON pr.visit_id = v.id
        JOIN "patient_profiles" p ON v.patient_id = p.id
        LEFT JOIN "doctors" d ON pr.doctor_id = d.id
        LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
        LEFT JOIN "users" u ON s.user_id = u.id
        ${whereClause}
        ORDER BY pr.created_at DESC
    `;

    const res = await pool.query(query, params);
    return res.rows;
}

export async function getPrescriptionByIdService(id: string) {
    const prescRes = await pool.query(
        `SELECT 
            pr.*,
            v.patient_id,
            p.name as patient_name,
            u.name as doctor_name
         FROM "prescriptions" pr
         JOIN "visits" v ON pr.visit_id = v.id
         JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "doctors" d ON pr.doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" u ON s.user_id = u.id
         WHERE pr.id = $1`,
        [id]
    );

    if (prescRes.rowCount === 0 || !prescRes.rows[0]) {
        throw new AppError("Prescription not found", 404);
    }

    const dispensesRes = await pool.query(
        `SELECT pd.*, u.name as dispensed_by_name
         FROM "pharmacy_dispenses" pd
         LEFT JOIN "staff_profiles" sp ON pd.dispensed_by = sp.id
         LEFT JOIN "users" u ON sp.user_id = u.id
         WHERE pd.prescription_id = $1
         ORDER BY pd.dispensed_at DESC`,
        [id]
    );

    return {
        ...prescRes.rows[0],
        dispenses: dispensesRes.rows.map((r) => ({
            ...r,
            dispensed_quantity: Number(r.quantity) || 1,
            created_at: r.dispensed_at,
        })),
    };
}
