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
    checked_in_at?: Date;
    completed_at?: Date | null;
    created_at: Date;
    createdAt: Date;
    updated_at: Date;
    updatedAt: Date;
}

export function formatVisit(row: any, registeredByUserId?: string | null): FormattedVisit {
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
        registeredBy: registeredByUserId !== undefined ? (registeredByUserId ?? row.registered_by ?? null) : (row.registered_by ?? null),
        status: row.status as VisitStatus,
        checked_in_at: row.checked_in_at,
        completed_at: row.completed_at ?? null,
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
    const patientRes = await pool.query<{ id: string; user_id: string }>(
        'SELECT id, owner_user_id as user_id FROM "patient_profiles" WHERE id = $1',
        [data.patientId]
    );

    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient not found", 404);
    }

    const patient = patientRes.rows[0];

    // If patient, ensure they own the patient record
    if (isPatient && patient.user_id && patient.user_id !== authUser.userId) {
        throw new AppError("Forbidden: cannot check in for another patient", 403);
    }

    // Resolve registeredBy (references staff_profiles.id)
    let registeredByStaffId: string | null = null;
    if (isStaff) {
        const staffLookup = await pool.query<{ id: string }>(
            'SELECT id FROM "staff_profiles" WHERE user_id = $1 OR id = $1',
            [data.registeredBy || authUser.userId]
        );
        if (staffLookup.rowCount && staffLookup.rows[0]) {
            registeredByStaffId = staffLookup.rows[0].id;
        }
    }

    // Map visit_type to enum: 'ONLINE' | 'WALKIN'.
    // OPD / APPOINTMENT / WALK-IN all map to the WALKIN enum value (the DB
    // visit_type enum only contains ONLINE and WALKIN).
    let visitType: "ONLINE" | "WALKIN" = "WALKIN";
    const rawType = (data.visitType || "").toUpperCase();
    if (rawType === "ONLINE") {
        visitType = "ONLINE";
    } else {
        visitType = "WALKIN";
    }

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
            visitType,
            data.departmentId ?? null,
            data.appointmentId ?? null,
            data.assignedDoctorId ?? null,
            registeredByStaffId,
        ]
    );

    const row = insertRes.rows[0];
    if (!row) {
        throw new AppError("Failed to create visit", 500);
    }

    // For patients self-checking-in, registered_by (a staff_profiles.id) is
    // null — surface the account user id instead for UI traceability.
    return formatVisit(row, isStaff ? registeredByStaffId : authUser.userId);
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
            doc_u.name as doctor_name
         FROM "visits" v
         LEFT JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "departments" dept ON v.department_id = dept.id
         LEFT JOIN "doctors" d ON v.assigned_doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
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
        pool.query(
            `SELECT 
                v.*, 
                v.pulse_bpm as heart_rate,
                v.pulse_bpm as "heartRate",
                v.spo2_percent as oxygen_saturation,
                v.spo2_percent as "oxygenSaturation",
                v.temperature_c as temperature,
                v.height_cm as height,
                v.weight_kg as weight,
                v.recorded_at as created_at,
                u.name as recorded_by_name
             FROM "vitals" v
             LEFT JOIN "staff_profiles" sp ON v.recorded_by = sp.id
             LEFT JOIN "users" u ON sp.user_id = u.id
             WHERE v.visit_id = $1
             ORDER BY v.recorded_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT 
                qe.*, 
                v.patient_id,
                v.patient_id as "patientId",
                dept.name as department_name, 
                doc_u.name as doctor_name
             FROM "queue_entries" qe
             JOIN "visits" v ON qe.visit_id = v.id
             LEFT JOIN "departments" dept ON qe.department_id = dept.id
             LEFT JOIN "doctors" doc ON qe.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE qe.visit_id = $1
             ORDER BY qe.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT c.*, doc_u.name as doctor_name
             FROM "consultations" c
             LEFT JOIN "doctors" doc ON c.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE c.visit_id = $1
             ORDER BY c.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT pr.*, doc_u.name as doctor_name
             FROM "prescriptions" pr
             LEFT JOIN "doctors" doc ON pr.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE pr.visit_id = $1
             ORDER BY pr.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT io.*, doc_u.name as doctor_name
             FROM "investigation_orders" io
             LEFT JOIN "doctors" doc ON io.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE io.visit_id = $1
             ORDER BY io.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT * FROM "invoices" WHERE visit_id = $1 ORDER BY created_at ASC`,
            [visitId]
        ),
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
            doc_u.name as doctor_name
         FROM "visits" v
         JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "departments" dept ON v.department_id = dept.id
         LEFT JOIN "doctors" d ON v.assigned_doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
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
        pool.query(
            `SELECT v.*, u.name as recorded_by_name
             FROM "vitals" v
             LEFT JOIN "staff_profiles" sp ON v.recorded_by = sp.id
             LEFT JOIN "users" u ON sp.user_id = u.id
             WHERE v.visit_id = $1
             ORDER BY v.recorded_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT qe.*, dept.name as department_name, doc_u.name as doctor_name
             FROM "queue_entries" qe
             LEFT JOIN "departments" dept ON qe.department_id = dept.id
             LEFT JOIN "doctors" doc ON qe.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE qe.visit_id = $1
             ORDER BY qe.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT c.*, doc_u.name as doctor_name
             FROM "consultations" c
             LEFT JOIN "doctors" doc ON c.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE c.visit_id = $1
             ORDER BY c.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT pr.*, doc_u.name as doctor_name
             FROM "prescriptions" pr
             LEFT JOIN "doctors" doc ON pr.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE pr.visit_id = $1
             ORDER BY pr.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT io.*, doc_u.name as doctor_name
             FROM "investigation_orders" io
             LEFT JOIN "doctors" doc ON io.doctor_id = doc.id
             LEFT JOIN "staff_profiles" s ON doc.staff_id = s.id
             LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
             WHERE io.visit_id = $1
             ORDER BY io.created_at ASC`,
            [visitId]
        ),
        pool.query(
            `SELECT * FROM "invoices" WHERE visit_id = $1 ORDER BY created_at ASC`,
            [visitId]
        ),
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
         LEFT JOIN "patient_profiles" p ON v.patient_id = p.id
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

    const completedAtClause = newStatus === "COMPLETED" ? ", completed_at = CURRENT_TIMESTAMP" : "";

    const updateRes = await pool.query(
        `UPDATE "visits"
         SET status = $1, updated_at = CURRENT_TIMESTAMP ${completedAtClause}
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
        conditions.push(`p.user_id = $${params.length}`);
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
            doc_u.name as doctor_name
        FROM "visits" v
        JOIN "patient_profiles" p ON v.patient_id = p.id
        LEFT JOIN "departments" dept ON v.department_id = dept.id
        LEFT JOIN "doctors" d ON v.assigned_doctor_id = d.id
        LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
        LEFT JOIN "users" doc_u ON s.user_id = doc_u.id
        ${whereClause}
        ORDER BY v.created_at DESC
    `;

    const res = await pool.query(query, params);
    return res.rows.map((row) => formatVisit(row));
}
