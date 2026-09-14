import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import type { CreateVisitInput, VisitStatus } from "./visits.schema.js";

export const VALID_TRANSITIONS: Record<VisitStatus, readonly VisitStatus[]> = {
    REGISTERED: ["VITALS", "CANCELLED"],
    VITALS: ["WAITING_OPD", "CANCELLED"],
    WAITING_OPD: ["IN_CONSULTATION", "BILLING", "CANCELLED"],
    IN_CONSULTATION: ["DIAGNOSTICS", "PHARMACY", "BILLING", "CANCELLED"],
    DIAGNOSTICS: ["PHARMACY", "BILLING", "CANCELLED"],
    PHARMACY: ["BILLING", "CANCELLED"],
    BILLING: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};

export function validateStatusTransition(
    currentStatus: VisitStatus,
    targetStatus: VisitStatus
): boolean {
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    return allowed.includes(targetStatus);
}

export interface FormattedVisit {
    id: string;
    patient_id: string;
    patientId: string;
    patient_name?: string | null;
    visit_type: string;
    visitType: string;
    department_id: string | null;
    departmentId: string | null;
    department_name?: string | null;
    appointment_id: string | null;
    appointmentId: string | null;
    assigned_doctor_id: string | null;
    assignedDoctorId: string | null;
    doctor_name?: string | null;
    registered_by: string | null;
    registeredBy: string | null;
    status: VisitStatus;
    created_at: Date;
    createdAt: Date;
    updated_at: Date;
    updatedAt: Date;
}

export function formatVisit(row: any): FormattedVisit {
    return {
        id: row.id,
        patient_id: row.patient_id,
        patientId: row.patient_id,
        patient_name: row.patient_name ?? null,
        visit_type: row.visit_type,
        visitType: row.visit_type,
        department_id: row.department_id ?? null,
        departmentId: row.department_id ?? null,
        department_name: row.department_name ?? null,
        appointment_id: row.appointment_id ?? null,
        appointmentId: row.appointment_id ?? null,
        assigned_doctor_id: row.assigned_doctor_id ?? null,
        assignedDoctorId: row.assigned_doctor_id ?? null,
        doctor_name: row.doctor_name ?? null,
        registered_by: row.registered_by ?? null,
        registeredBy: row.registered_by ?? null,
        status: row.status as VisitStatus,
        created_at: row.created_at,
        createdAt: row.created_at,
        updated_at: row.updated_at,
        updatedAt: row.updated_at,
    };
}

export async function createVisitService(
    data: CreateVisitInput,
    authUser: AuthPayload
): Promise<FormattedVisit> {
    const isStaff = authUser.role === "STAFF" || authUser.role === "ADMIN";
    const isPatient = authUser.role === "PATIENT" || authUser.role === "USER";

    if (!isStaff && !isPatient) {
        throw new AppError("Forbidden: insufficient permissions", 403);
    }

    // Verify patient exists
    const patientRes = await pool.query<{ id: string; owner_user_id: string }>(
        'SELECT id, owner_user_id FROM "Patient" WHERE id = $1',
        [data.patientId]
    );

    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient not found", 404);
    }

    const patient = patientRes.rows[0];

    // If patient, ensure they own the patient record
    if (isPatient && patient.owner_user_id !== authUser.userId) {
        throw new AppError("Forbidden: cannot check in for another patient", 403);
    }

    const registeredBy = isStaff ? (data.registeredBy || authUser.userId) : authUser.userId;

    const insertRes = await pool.query(
        `INSERT INTO "visits" (
            patient_id,
            visit_type,
            department_id,
            appointment_id,
            assigned_doctor_id,
            registered_by,
            status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'REGISTERED')
        RETURNING *`,
        [
            data.patientId,
            data.visitType,
            data.departmentId,
            data.appointmentId,
            data.assignedDoctorId,
            registeredBy,
        ]
    );

    const row = insertRes.rows[0];
    if (!row) {
        throw new AppError("Failed to create visit", 500);
    }

    return formatVisit(row);
}

export async function getVisitByIdService(
    visitId: string,
    authUser: AuthPayload
) {
    const visitRes = await pool.query(
        `SELECT 
            v.*,
            p.name as patient_name,
            p.owner_user_id as patient_owner_user_id,
            dept.name as department_name,
            COALESCE(u.name, d.name) as doctor_name
         FROM "visits" v
         LEFT JOIN "Patient" p ON v.patient_id = p.id
         LEFT JOIN "Department" dept ON v.department_id = dept.id
         LEFT JOIN "Doctor" d ON v.assigned_doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         WHERE v.id = $1`,
        [visitId]
    );

    if (visitRes.rowCount === 0 || !visitRes.rows[0]) {
        throw new AppError("Visit not found", 404);
    }

    const visitRow = visitRes.rows[0];

    const isStaff = authUser.role === "STAFF" || authUser.role === "ADMIN";
    const isOwner = visitRow.patient_owner_user_id === authUser.userId;

    if (!isStaff && !isOwner) {
        throw new AppError("Forbidden: access denied to this visit", 403);
    }

    // Sub-queries for joined vitals, queue_entries, consultations, prescriptions, investigation_orders, invoices
    const [
        vitalsRes,
        queueEntriesRes,
        consultationsRes,
        prescriptionsRes,
        investigationsRes,
        invoicesRes,
    ] = await Promise.all([
        pool.query('SELECT * FROM "vitals" WHERE visit_id = $1 ORDER BY created_at ASC', [visitId]),
        pool.query(
            `SELECT qe.*, dept.name as department_name, COALESCE(u.name, doc.name) as doctor_name
             FROM "QueueEntry" qe
             LEFT JOIN "Department" dept ON qe.department_id = dept.id
             LEFT JOIN "Doctor" doc ON qe.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE qe.visit_id = $1
                OR (qe.appointment_id = $2 AND $2 IS NOT NULL)
             ORDER BY qe.created_at ASC`,
            [visitId, visitRow.appointment_id]
        ),
        pool.query(
            `SELECT c.*, COALESCE(u.name, doc.name) as doctor_name
             FROM "Consultation" c
             LEFT JOIN "Doctor" doc ON c.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE c.visit_id = $1
                OR (c.appointment_id = $2 AND $2 IS NOT NULL)
             ORDER BY c.created_at ASC`,
            [visitId, visitRow.appointment_id]
        ),
        pool.query(
            `SELECT pr.*, COALESCE(u.name, doc.name) as doctor_name
             FROM "Prescription" pr
             LEFT JOIN "Doctor" doc ON pr.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE pr.visit_id = $1
                OR pr.consultation_id IN (
                    SELECT id FROM "Consultation" WHERE visit_id = $1 OR (appointment_id = $2 AND $2 IS NOT NULL)
                )
             ORDER BY pr.created_at ASC`,
            [visitId, visitRow.appointment_id]
        ),
        pool.query(
            `SELECT io.*, COALESCE(u.name, doc.name) as doctor_name
             FROM "InvestigationOrder" io
             LEFT JOIN "Doctor" doc ON io.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE io.visit_id = $1
             ORDER BY io.created_at ASC`,
            [visitId]
        ),
        pool.query('SELECT * FROM "invoices" WHERE visit_id = $1 ORDER BY created_at ASC', [visitId]),
    ]);

    const formatted = formatVisit(visitRow);

    return {
        ...formatted,
        vitals: vitalsRes.rows,
        queue_entries: queueEntriesRes.rows,
        queueEntries: queueEntriesRes.rows,
        consultations: consultationsRes.rows,
        prescriptions: prescriptionsRes.rows,
        investigation_orders: investigationsRes.rows,
        investigationOrders: investigationsRes.rows,
        invoices: invoicesRes.rows,
    };
}

export async function getCurrentPatientVisitService(userId: string) {
    const visitRes = await pool.query(
        `SELECT 
            v.*,
            p.name as patient_name,
            p.owner_user_id as patient_owner_user_id,
            dept.name as department_name,
            COALESCE(u.name, d.name) as doctor_name
         FROM "visits" v
         JOIN "Patient" p ON v.patient_id = p.id
         LEFT JOIN "Department" dept ON v.department_id = dept.id
         LEFT JOIN "Doctor" d ON v.assigned_doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         WHERE p.owner_user_id = $1
           AND v.status NOT IN ('COMPLETED', 'CANCELLED')
         ORDER BY v.created_at DESC
         LIMIT 1`,
        [userId]
    );

    if (visitRes.rowCount === 0 || !visitRes.rows[0]) {
        return null;
    }

    const visitRow = visitRes.rows[0];
    const visitId = visitRow.id;

    const [
        vitalsRes,
        queueEntriesRes,
        consultationsRes,
        prescriptionsRes,
        investigationsRes,
        invoicesRes,
    ] = await Promise.all([
        pool.query('SELECT * FROM "vitals" WHERE visit_id = $1 ORDER BY created_at ASC', [visitId]),
        pool.query(
            `SELECT qe.*, dept.name as department_name, COALESCE(u.name, doc.name) as doctor_name
             FROM "QueueEntry" qe
             LEFT JOIN "Department" dept ON qe.department_id = dept.id
             LEFT JOIN "Doctor" doc ON qe.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE qe.visit_id = $1
                OR (qe.appointment_id = $2 AND $2 IS NOT NULL)
             ORDER BY qe.created_at ASC`,
            [visitId, visitRow.appointment_id]
        ),
        pool.query(
            `SELECT c.*, COALESCE(u.name, doc.name) as doctor_name
             FROM "Consultation" c
             LEFT JOIN "Doctor" doc ON c.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE c.visit_id = $1
                OR (c.appointment_id = $2 AND $2 IS NOT NULL)
             ORDER BY c.created_at ASC`,
            [visitId, visitRow.appointment_id]
        ),
        pool.query(
            `SELECT pr.*, COALESCE(u.name, doc.name) as doctor_name
             FROM "Prescription" pr
             LEFT JOIN "Doctor" doc ON pr.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE pr.visit_id = $1
                OR pr.consultation_id IN (
                    SELECT id FROM "Consultation" WHERE visit_id = $1 OR (appointment_id = $2 AND $2 IS NOT NULL)
                )
             ORDER BY pr.created_at ASC`,
            [visitId, visitRow.appointment_id]
        ),
        pool.query(
            `SELECT io.*, COALESCE(u.name, doc.name) as doctor_name
             FROM "InvestigationOrder" io
             LEFT JOIN "Doctor" doc ON io.doctor_id = doc.id
             LEFT JOIN "Staff" s ON doc.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE io.visit_id = $1
             ORDER BY io.created_at ASC`,
            [visitId]
        ),
        pool.query('SELECT * FROM "invoices" WHERE visit_id = $1 ORDER BY created_at ASC', [visitId]),
    ]);

    const formatted = formatVisit(visitRow);

    return {
        ...formatted,
        vitals: vitalsRes.rows,
        queue_entries: queueEntriesRes.rows,
        queueEntries: queueEntriesRes.rows,
        consultations: consultationsRes.rows,
        prescriptions: prescriptionsRes.rows,
        investigation_orders: investigationsRes.rows,
        investigationOrders: investigationsRes.rows,
        invoices: invoicesRes.rows,
    };
}

export async function updateVisitStatusService(
    visitId: string,
    newStatus: VisitStatus,
    authUser: AuthPayload
): Promise<FormattedVisit> {
    const existingRes = await pool.query(
        `SELECT v.*, p.owner_user_id as patient_owner_user_id
         FROM "visits" v
         LEFT JOIN "Patient" p ON v.patient_id = p.id
         WHERE v.id = $1`,
        [visitId]
    );

    if (existingRes.rowCount === 0 || !existingRes.rows[0]) {
        throw new AppError("Visit not found", 404);
    }

    const visit = existingRes.rows[0];
    const currentStatus = visit.status as VisitStatus;

    const isStaff = authUser.role === "STAFF" || authUser.role === "ADMIN";
    const isOwner = visit.patient_owner_user_id === authUser.userId;

    if (!isStaff && !isOwner) {
        throw new AppError("Forbidden: access denied to this visit", 403);
    }

    // Patients can only cancel their visits
    if (!isStaff && isOwner && newStatus !== "CANCELLED") {
        throw new AppError("Patients can only cancel active visits", 403);
    }

    if (!validateStatusTransition(currentStatus, newStatus)) {
        throw new AppError(
            `Illegal status transition: cannot transition from ${currentStatus} to ${newStatus}`,
            400
        );
    }

    const updateRes = await pool.query(
        `UPDATE "visits"
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [newStatus, visitId]
    );

    const updated = updateRes.rows[0];
    return formatVisit(updated);
}

export async function listVisitsService(
    status?: string,
    authUser?: AuthPayload
): Promise<FormattedVisit[]> {
    const isStaff = authUser?.role === "STAFF" || authUser?.role === "ADMIN";
    const conditions: string[] = [];
    const params: any[] = [];

    if (!isStaff && authUser?.userId) {
        params.push(authUser.userId);
        conditions.push(`p.owner_user_id = $${params.length}`);
    }

    if (status) {
        params.push(status);
        conditions.push(`v.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            v.*,
            p.name as patient_name,
            p.owner_user_id as patient_owner_user_id,
            dept.name as department_name,
            COALESCE(u.name, d.name) as doctor_name
        FROM "visits" v
        JOIN "Patient" p ON v.patient_id = p.id
        LEFT JOIN "Department" dept ON v.department_id = dept.id
        LEFT JOIN "Doctor" d ON v.assigned_doctor_id = d.id
        LEFT JOIN "Staff" s ON d.staff_id = s.id
        LEFT JOIN "User" u ON s.user_id = u.id
        ${whereClause}
        ORDER BY v.created_at DESC
    `;

    const res = await pool.query(query, params);
    return res.rows.map(formatVisit);
}
