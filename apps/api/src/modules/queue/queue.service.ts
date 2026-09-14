import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { createVisitService, updateVisitStatusService } from "#modules/visits/visits.service.js";
import type { JoinQueueInput, QueueFilterQuery } from "./queue.schema.js";

interface QueueEntryRow {
    id: string;
    visit_id: string | null;
    patient_id: string;
    doctor_id: string | null;
    department_id: string | null;
    appointment_id: string | null;
    type: string;
    priority: number;
    status: string;
    joined_at: Date;
    scheduled_time: Date | null;
    started_at: Date | null;
    completed_at: Date | null;
    called_at: Date | null;
    created_at: Date;
}

export async function calculateQueuePosition(
    doctorId: string | null,
    priority: number,
    joinedAt: Date
): Promise<number> {
    const posRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM "QueueEntry"
         WHERE status IN ('WAITING', 'CALLED')
           AND (($1::uuid IS NULL AND doctor_id IS NULL) OR doctor_id = $1::uuid)
           AND (priority > $2 OR (priority = $2 AND joined_at <= $3))`,
        [doctorId, priority, joinedAt]
    );

    return Number(posRes.rows[0]?.count ?? 1);
}

export async function joinQueueService(data: JoinQueueInput, authUser?: AuthPayload) {
    let visitId = data.visitId || data.visit_id || null;
    let patientId = data.patientId || data.patient_id || null;
    let doctorId = data.doctorId || data.doctor_id || null;
    let departmentId = data.departmentId || data.department_id || null;
    let appointmentId = data.appointmentId || data.appointment_id || null;
    const type = data.type ?? "WALK_IN";
    let priority = data.priority ?? 0;

    // If emergency, ensure priority is high
    if (type === "EMERGENCY" && priority === 0) {
        priority = 100;
    }

    // If appointment ID provided, resolve details if not present
    if (appointmentId) {
        const apptRes = await pool.query<{ id: string; doctor_id: string }>(
            'SELECT id, doctor_id FROM "Appointment" WHERE id = $1',
            [appointmentId]
        );
        if (apptRes.rowCount && apptRes.rows[0]) {
            if (!doctorId) {
                doctorId = apptRes.rows[0].doctor_id;
            }
        }
    }

    // If doctorId provided but departmentId is missing, resolve doctor's department
    if (doctorId && !departmentId) {
        const docRes = await pool.query<{ department_id: string | null }>(
            'SELECT department_id FROM "Doctor" WHERE id = $1',
            [doctorId]
        );
        if (docRes.rowCount && docRes.rows[0]?.department_id) {
            departmentId = docRes.rows[0].department_id;
        }
    }

    // If visitId is not provided, create one first via createVisitService
    if (!visitId) {
        if (!patientId) {
            throw new AppError("patientId is required when visitId is not provided", 400);
        }

        const patientRes = await pool.query<{ id: string; owner_user_id: string }>(
            'SELECT id, owner_user_id FROM "Patient" WHERE id = $1',
            [patientId]
        );
        if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
            throw new AppError("Patient not found", 404);
        }

        const callerAuth: AuthPayload = authUser || {
            userId: patientRes.rows[0].owner_user_id,
            email: "queue@hospital.internal",
            role: "PATIENT",
        };

        const createdVisit = await createVisitService(
            {
                patientId,
                visitType: type as any,
                departmentId: departmentId ?? null,
                appointmentId: appointmentId ?? null,
                assignedDoctorId: doctorId ?? null,
                registeredBy: authUser?.userId ?? null,
            },
            callerAuth
        );
        visitId = createdVisit.id;
    }

    // Verify visit exists and fetch details
    const visitRes = await pool.query<{
        id: string;
        patient_id: string;
        department_id: string | null;
        appointment_id: string | null;
        assigned_doctor_id: string | null;
        visit_type: string;
        status: string;
    }>(
        'SELECT id, patient_id, department_id, appointment_id, assigned_doctor_id, visit_type, status FROM "visits" WHERE id = $1',
        [visitId]
    );

    if (visitRes.rowCount === 0 || !visitRes.rows[0]) {
        throw new AppError("Visit not found", 404);
    }

    const visit = visitRes.rows[0];
    patientId = patientId || visit.patient_id;
    doctorId = doctorId || visit.assigned_doctor_id;
    departmentId = departmentId || visit.department_id;
    appointmentId = appointmentId || visit.appointment_id;

    // Transition visit status to WAITING_OPD via updateVisitStatusService
    const transitionAuth: AuthPayload = {
        userId: authUser?.userId || "system",
        email: authUser?.email || "system@hospital.internal",
        role: "STAFF",
        staffRole: (authUser?.staffRole as any) || "RECEPTIONIST",
    };

    if (visit.status === "REGISTERED") {
        await updateVisitStatusService(visitId, "VITALS", transitionAuth);
        await updateVisitStatusService(visitId, "WAITING_OPD", transitionAuth);
    } else if (visit.status === "VITALS") {
        await updateVisitStatusService(visitId, "WAITING_OPD", transitionAuth);
    }

    const scheduledTime = data.scheduledTime || data.scheduled_time
        ? new Date((data.scheduledTime || data.scheduled_time)!)
        : null;

    const insertRes = await pool.query<QueueEntryRow>(
        `INSERT INTO "QueueEntry" (
            patient_id,
            doctor_id,
            department_id,
            appointment_id,
            type,
            priority,
            status,
            scheduled_time,
            joined_at,
            visit_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'WAITING', $7, CURRENT_TIMESTAMP, $8)
         RETURNING *`,
        [
            patientId,
            doctorId,
            departmentId,
            appointmentId,
            type,
            priority,
            scheduledTime,
            visitId,
        ]
    );

    const entry = insertRes.rows[0];
    if (!entry) {
        throw new AppError("Failed to create queue entry", 500);
    }

    const position = await calculateQueuePosition(doctorId, priority, entry.joined_at);

    return {
        ...entry,
        visit_id: entry.visit_id,
        visitId: entry.visit_id,
        position,
    };
}

export async function getQueueService(filter: QueueFilterQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.doctorId) {
        params.push(filter.doctorId);
        conditions.push(`q.doctor_id = $${params.length}`);
    }

    if (filter.departmentId) {
        params.push(filter.departmentId);
        conditions.push(`q.department_id = $${params.length}`);
    }

    if (filter.status) {
        params.push(filter.status);
        conditions.push(`q.status = $${params.length}`);
    } else {
        conditions.push(`q.status IN ('WAITING', 'CALLED', 'IN_PROGRESS', 'SERVING')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            q.id,
            q.visit_id,
            q.visit_id as "visitId",
            q.patient_id,
            q.patient_id as "patientId",
            p.name as patient_name,
            p.age as patient_age,
            p.gender as patient_gender,
            p.patient_type,
            q.doctor_id,
            q.doctor_id as "doctorId",
            COALESCE(u.name, d.name) as doctor_name,
            q.department_id,
            q.department_id as "departmentId",
            COALESCE(dept.name, d.department) as department_name,
            q.appointment_id,
            q.appointment_id as "appointmentId",
            q.type,
            q.priority,
            q.status,
            q.joined_at,
            q.scheduled_time,
            q.started_at,
            q.completed_at,
            q.called_at,
            q.created_at
        FROM "QueueEntry" q
        JOIN "Patient" p ON q.patient_id = p.id
        LEFT JOIN "Doctor" d ON q.doctor_id = d.id
        LEFT JOIN "Staff" s ON d.staff_id = s.id
        LEFT JOIN "User" u ON s.user_id = u.id
        LEFT JOIN "Department" dept ON q.department_id = dept.id
        ${whereClause}
        ORDER BY q.priority DESC, q.joined_at ASC
    `;

    const res = await pool.query(query, params);
    const queue = res.rows.map((row, index) => ({
        ...row,
        position: index + 1,
    }));

    const waitingCount = queue.filter((r) => r.status === "WAITING").length;

    let currentServing =
        queue.find((r) => r.status === "IN_PROGRESS" || r.status === "SERVING") ||
        queue.find((r) => r.status === "CALLED") ||
        null;

    if (!currentServing && filter.doctorId && filter.status) {
        const servingRes = await pool.query(
            `SELECT 
                q.id,
                q.visit_id,
                q.visit_id as "visitId",
                q.patient_id,
                p.name as patient_name,
                q.doctor_id,
                COALESCE(u.name, d.name) as doctor_name,
                q.status
             FROM "QueueEntry" q
             JOIN "Patient" p ON q.patient_id = p.id
             LEFT JOIN "Doctor" d ON q.doctor_id = d.id
             LEFT JOIN "Staff" s ON d.staff_id = s.id
             LEFT JOIN "User" u ON s.user_id = u.id
             WHERE q.doctor_id = $1
               AND q.status IN ('IN_PROGRESS', 'SERVING', 'CALLED')
             ORDER BY CASE WHEN q.status IN ('IN_PROGRESS', 'SERVING') THEN 1 ELSE 2 END, q.started_at DESC NULLS LAST
             LIMIT 1`,
            [filter.doctorId]
        );
        if (servingRes.rowCount && servingRes.rows[0]) {
            currentServing = servingRes.rows[0];
        }
    }

    return {
        queue,
        waitingCount,
        currentServing,
    };
}

export async function callNextService(doctorId: string) {
    const nextRes = await pool.query<QueueEntryRow>(
        `SELECT id
         FROM "QueueEntry"
         WHERE doctor_id = $1
           AND status = 'WAITING'
         ORDER BY priority DESC, joined_at ASC
         LIMIT 1`,
        [doctorId]
    );

    if (nextRes.rowCount === 0 || !nextRes.rows[0]) {
        return null;
    }

    const nextId = nextRes.rows[0].id;
    const updateRes = await pool.query<QueueEntryRow>(
        `UPDATE "QueueEntry"
         SET status = 'CALLED',
             called_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [nextId]
    );

    const row = updateRes.rows[0];
    return row
        ? {
              ...row,
              visitId: row.visit_id,
              visit_id: row.visit_id,
          }
        : null;
}

export async function startServingService(
    queueEntryId: string,
    doctorId?: string,
    authUser?: AuthPayload
) {
    const checkRes = await pool.query<QueueEntryRow>(
        'SELECT id, doctor_id, status, visit_id FROM "QueueEntry" WHERE id = $1',
        [queueEntryId]
    );

    if (checkRes.rowCount === 0 || !checkRes.rows[0]) {
        throw new AppError("Queue entry not found", 404);
    }

    const currentEntry = checkRes.rows[0];

    if (doctorId && currentEntry.doctor_id && currentEntry.doctor_id !== doctorId) {
        throw new AppError("Forbidden: this queue entry belongs to another doctor", 403);
    }

    const updateRes = await pool.query<QueueEntryRow>(
        `UPDATE "QueueEntry"
         SET status = 'IN_PROGRESS',
             started_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [queueEntryId]
    );

    const updated = updateRes.rows[0];

    // Update the linked visit's status to IN_CONSULTATION
    if (currentEntry.visit_id) {
        const visitRes = await pool.query<{ status: string }>(
            'SELECT status FROM "visits" WHERE id = $1',
            [currentEntry.visit_id]
        );
        if (visitRes.rowCount && visitRes.rows[0]) {
            const vStatus = visitRes.rows[0].status;
            const transitionAuth: AuthPayload = {
                userId: authUser?.userId || doctorId || "system",
                email: authUser?.email || "system@hospital.internal",
                role: "STAFF",
                staffRole: (authUser?.staffRole as any) || "DOCTOR",
            };

            if (vStatus === "REGISTERED") {
                await updateVisitStatusService(currentEntry.visit_id, "VITALS", transitionAuth);
                await updateVisitStatusService(currentEntry.visit_id, "WAITING_OPD", transitionAuth);
                await updateVisitStatusService(currentEntry.visit_id, "IN_CONSULTATION", transitionAuth);
            } else if (vStatus === "VITALS") {
                await updateVisitStatusService(currentEntry.visit_id, "WAITING_OPD", transitionAuth);
                await updateVisitStatusService(currentEntry.visit_id, "IN_CONSULTATION", transitionAuth);
            } else if (vStatus === "WAITING_OPD") {
                await updateVisitStatusService(currentEntry.visit_id, "IN_CONSULTATION", transitionAuth);
            }
        }
    }

    return {
        ...updated,
        visitId: updated?.visit_id,
        visit_id: updated?.visit_id,
    };
}

export async function completeQueueEntryService(queueEntryId: string, doctorId?: string) {
    const checkRes = await pool.query<QueueEntryRow>(
        'SELECT id, doctor_id, status, visit_id FROM "QueueEntry" WHERE id = $1',
        [queueEntryId]
    );

    if (checkRes.rowCount === 0 || !checkRes.rows[0]) {
        throw new AppError("Queue entry not found", 404);
    }

    if (doctorId && checkRes.rows[0].doctor_id && checkRes.rows[0].doctor_id !== doctorId) {
        throw new AppError("Forbidden: this queue entry belongs to another doctor", 403);
    }

    const updateRes = await pool.query<QueueEntryRow>(
        `UPDATE "QueueEntry"
         SET status = 'COMPLETED',
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [queueEntryId]
    );

    const updated = updateRes.rows[0];
    return {
        ...updated,
        visitId: updated?.visit_id,
        visit_id: updated?.visit_id,
    };
}

export async function skipQueueEntryService(queueEntryId: string, doctorId?: string) {
    const checkRes = await pool.query<QueueEntryRow>(
        'SELECT id, doctor_id, status, visit_id FROM "QueueEntry" WHERE id = $1',
        [queueEntryId]
    );

    if (checkRes.rowCount === 0 || !checkRes.rows[0]) {
        throw new AppError("Queue entry not found", 404);
    }

    if (doctorId && checkRes.rows[0].doctor_id && checkRes.rows[0].doctor_id !== doctorId) {
        throw new AppError("Forbidden: this queue entry belongs to another doctor", 403);
    }

    const updateRes = await pool.query<QueueEntryRow>(
        `UPDATE "QueueEntry"
         SET status = 'SKIPPED'
         WHERE id = $1
         RETURNING *`,
        [queueEntryId]
    );

    const updated = updateRes.rows[0];
    return {
        ...updated,
        visitId: updated?.visit_id,
        visit_id: updated?.visit_id,
    };
}

export async function getMyPatientQueueStatusService(userId: string) {
    const res = await pool.query(
        `SELECT 
            q.id,
            q.visit_id,
            q.visit_id as "visitId",
            q.patient_id,
            q.patient_id as "patientId",
            p.name as patient_name,
            q.doctor_id,
            q.doctor_id as "doctorId",
            COALESCE(u.name, d.name) as doctor_name,
            d.specialization as doctor_specialization,
            COALESCE(dept.name, d.department) as department_name,
            q.type,
            q.priority,
            q.status,
            q.joined_at,
            q.scheduled_time,
            q.started_at,
            q.called_at
         FROM "QueueEntry" q
         JOIN "Patient" p ON q.patient_id = p.id
         LEFT JOIN "Doctor" d ON q.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Department" dept ON q.department_id = dept.id
         WHERE p.owner_user_id = $1
           AND q.status IN ('WAITING', 'CALLED', 'IN_PROGRESS', 'SERVING')
         ORDER BY q.joined_at DESC
         LIMIT 1`,
        [userId]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        return {
            queueEntry: null,
            position: null,
            waitingCount: 0,
            currentServing: null,
            message: "No active queue entry found",
        };
    }

    const entry = res.rows[0];
    const position = await calculateQueuePosition(entry.doctor_id, entry.priority, entry.joined_at);

    // Calculate waiting count for this doctor / queue
    const waitingRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM "QueueEntry"
         WHERE status = 'WAITING'
           AND (($1::uuid IS NULL AND doctor_id IS NULL) OR doctor_id = $1::uuid)`,
        [entry.doctor_id]
    );
    const waitingCount = Number(waitingRes.rows[0]?.count ?? 0);

    // Calculate currentServing for this doctor
    const servingRes = await pool.query(
        `SELECT 
            q.id,
            q.visit_id,
            q.visit_id as "visitId",
            q.patient_id,
            p.name as patient_name,
            q.doctor_id,
            COALESCE(u.name, d.name) as doctor_name,
            q.status
         FROM "QueueEntry" q
         JOIN "Patient" p ON q.patient_id = p.id
         LEFT JOIN "Doctor" d ON q.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         WHERE (($1::uuid IS NULL AND q.doctor_id IS NULL) OR q.doctor_id = $1::uuid)
           AND q.status IN ('IN_PROGRESS', 'SERVING', 'CALLED')
         ORDER BY CASE WHEN q.status IN ('IN_PROGRESS', 'SERVING') THEN 1 ELSE 2 END, q.started_at DESC NULLS LAST
         LIMIT 1`,
        [entry.doctor_id]
    );

    const currentServing = servingRes.rowCount && servingRes.rows[0] ? servingRes.rows[0] : null;

    return {
        queueEntry: {
            ...entry,
            visit_id: entry.visit_id,
            visitId: entry.visit_id,
        },
        position,
        waitingCount,
        currentServing,
    };
}

export async function getMyDoctorQueueService(doctorId: string) {
    return getQueueService({ doctorId });
}
