import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { createVisitService } from "#modules/visits/visits.service.js";
import type { CreateLabOrderInput, LabOrderFilterQuery, UpdateLabOrderInput } from "./lab-orders.schema.js";

export async function createLabOrderService(
    doctorId: string | null,
    patientId: string,
    data: CreateLabOrderInput,
    authUser?: AuthPayload
) {
    const patientRes = await pool.query<{ id: string; owner_user_id: string }>(
        'SELECT id, owner_user_id FROM "Patient" WHERE id = $1',
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
        let validUserId = patientRes.rows[0].owner_user_id;
        if (authUser?.userId) {
            const userCheck = await pool.query<{ id: string }>(
                'SELECT id FROM "User" WHERE id = $1',
                [authUser.userId]
            );
            if (userCheck.rowCount) {
                validUserId = authUser.userId;
            }
        }

        const callerAuth: AuthPayload = {
            userId: validUserId,
            email: authUser?.email || "system@hospital.internal",
            role: "PATIENT",
        };

        const createdVisit = await createVisitService(
            {
                patientId,
                visitType: "OPD",
                assignedDoctorId: resolvedDoctorId,
                departmentId: null,
                appointmentId: null,
                registeredBy: validUserId,
            },
            callerAuth
        );
        visitId = createdVisit.id;
    }

    const orderRes = await pool.query(
        `INSERT INTO "InvestigationOrder" (
            patient_id,
            doctor_id,
            visit_id,
            test_name,
            instructions,
            status
         )
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING *`,
        [
            patientId,
            resolvedDoctorId,
            visitId,
            testName,
            data.instructions ?? null,
        ]
    );

    return orderRes.rows[0];
}

export async function getLabOrdersService(filter: LabOrderFilterQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.patientId) {
        params.push(filter.patientId);
        conditions.push(`io.patient_id = $${params.length}`);
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
            p.name as patient_name,
            COALESCE(u.name, d.name) as doctor_name,
            tech.name as performed_by_name
        FROM "InvestigationOrder" io
        JOIN "Patient" p ON io.patient_id = p.id
        LEFT JOIN "Doctor" d ON io.doctor_id = d.id
        LEFT JOIN "Staff" s ON d.staff_id = s.id
        LEFT JOIN "User" u ON s.user_id = u.id
        LEFT JOIN "User" tech ON io.performed_by = tech.id
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
            p.name as patient_name,
            COALESCE(u.name, d.name) as doctor_name,
            tech.name as performed_by_name
         FROM "InvestigationOrder" io
         JOIN "Patient" p ON io.patient_id = p.id
         LEFT JOIN "Doctor" d ON io.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "User" tech ON io.performed_by = tech.id
         WHERE io.id = $1`,
        [id]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Investigation order not found", 404);
    }

    return res.rows[0];
}

export async function updateLabOrderService(
    id: string,
    data: UpdateLabOrderInput,
    authUser?: AuthPayload
) {
    const checkRes = await pool.query(
        'SELECT * FROM "InvestigationOrder" WHERE id = $1',
        [id]
    );

    if (checkRes.rowCount === 0 || !checkRes.rows[0]) {
        throw new AppError("Investigation order not found", 404);
    }

    const existing = checkRes.rows[0];
    const newStatus = data.status ?? existing.status;
    const newResult = data.result !== undefined ? data.result : existing.result;
    const newInstructions = data.instructions !== undefined ? data.instructions : existing.instructions;
    let performedBy = authUser?.userId ?? existing.performed_by;
    if (performedBy) {
        const uCheck = await pool.query('SELECT id FROM "User" WHERE id = $1', [performedBy]);
        if (uCheck.rowCount === 0) {
            performedBy = null;
        }
    }

    const updateRes = await pool.query(
        `UPDATE "InvestigationOrder"
         SET status = $1,
             result = $2,
             instructions = $3,
             performed_by = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [newStatus, newResult, newInstructions, performedBy, id]
    );

    return updateRes.rows[0];
}

export async function getPatientReportsService(doctorId: string, patientId: string) {
    const patientRes = await pool.query('SELECT id FROM "Patient" WHERE id = $1', [patientId]);
    if (patientRes.rowCount === 0) {
        throw new AppError("Patient not found", 404);
    }

    const reportsRes = await pool.query(
        `SELECT 
            r.id,
            r.visit_id,
            r.test_name,
            r.instructions,
            r.status,
            r.result,
            r.created_at,
            r.updated_at,
            d.id as doctor_id,
            COALESCE(u.name, d.name) as doctor_name
         FROM "InvestigationOrder" r
         LEFT JOIN "Doctor" d ON r.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         WHERE r.patient_id = $1
         ORDER BY r.created_at DESC`,
        [patientId]
    );

    return { reports: reportsRes.rows };
}

export { createLabOrderService as createInvestigationOrderService };
