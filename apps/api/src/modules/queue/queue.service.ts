import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { JoinQueueInput, QueueFilterQuery } from "./queue.schema.js";

interface QueueEntryRow {
    id: string;
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

export async function joinQueueService(data: JoinQueueInput) {
    // Validate patient exists
    const patientRes = await pool.query<{ id: string }>(
        'SELECT id FROM "Patient" WHERE id = $1',
        [data.patientId]
    );
    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient not found", 404);
    }

    let doctorId = data.doctorId ?? null;
    let departmentId = data.departmentId ?? null;
    let priority = data.priority ?? 0;

    // If emergency, ensure priority is high
    if (data.type === "EMERGENCY" && priority === 0) {
        priority = 100;
    }

    // If appointment ID provided, resolve details if not present
    if (data.appointmentId) {
        const apptRes = await pool.query<{ id: string; doctor_id: string }>(
            'SELECT id, doctor_id FROM "Appointment" WHERE id = $1',
            [data.appointmentId]
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

    const scheduledTime = data.scheduledTime ? new Date(data.scheduledTime) : null;

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
            joined_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'WAITING', $7, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
            data.patientId,
            doctorId,
            departmentId,
            data.appointmentId ?? null,
            data.type ?? "WALK_IN",
            priority,
            scheduledTime,
        ]
    );

    const entry = insertRes.rows[0];
    if (!entry) {
        throw new AppError("Failed to create queue entry", 500);
    }

    const position = await calculateQueuePosition(doctorId, priority, entry.joined_at);

    return {
        ...entry,
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
        conditions.push(`q.status IN ('WAITING', 'CALLED', 'SERVING')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            q.id,
            q.patient_id,
            p.name as patient_name,
            p.age as patient_age,
            p.gender as patient_gender,
            p.patient_type,
            q.doctor_id,
            COALESCE(u.name, d.name) as doctor_name,
            q.department_id,
            COALESCE(dept.name, d.department) as department_name,
            q.appointment_id,
            q.type,
            q.priority,
            q.status,
            q.joined_at,
            q.scheduled_time,
            q.started_at,
            q.completed_at,
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

    return { queue };
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
         SET status = 'CALLED'
         WHERE id = $1
         RETURNING *`,
        [nextId]
    );

    return updateRes.rows[0];
}

export async function startServingService(queueEntryId: string, doctorId?: string) {
    const checkRes = await pool.query<QueueEntryRow>(
        'SELECT id, doctor_id, status FROM "QueueEntry" WHERE id = $1',
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
         SET status = 'SERVING',
             started_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [queueEntryId]
    );

    return updateRes.rows[0];
}

export async function completeQueueEntryService(queueEntryId: string, doctorId?: string) {
    const checkRes = await pool.query<QueueEntryRow>(
        'SELECT id, doctor_id, status FROM "QueueEntry" WHERE id = $1',
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

    return updateRes.rows[0];
}

export async function skipQueueEntryService(queueEntryId: string, doctorId?: string) {
    const checkRes = await pool.query<QueueEntryRow>(
        'SELECT id, doctor_id, status FROM "QueueEntry" WHERE id = $1',
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

    return updateRes.rows[0];
}

export async function getMyPatientQueueStatusService(userId: string) {
    const res = await pool.query(
        `SELECT 
            q.id,
            q.patient_id,
            p.name as patient_name,
            q.doctor_id,
            COALESCE(u.name, d.name) as doctor_name,
            d.specialization as doctor_specialization,
            COALESCE(dept.name, d.department) as department_name,
            q.type,
            q.priority,
            q.status,
            q.joined_at,
            q.scheduled_time,
            q.started_at
         FROM "QueueEntry" q
         JOIN "Patient" p ON q.patient_id = p.id
         LEFT JOIN "Doctor" d ON q.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         LEFT JOIN "Department" dept ON q.department_id = dept.id
         WHERE p.owner_user_id = $1
           AND q.status IN ('WAITING', 'CALLED', 'SERVING')
         ORDER BY q.joined_at DESC
         LIMIT 1`,
        [userId]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        return { queueEntry: null, position: null, message: "No active queue entry found" };
    }

    const entry = res.rows[0];
    const position = await calculateQueuePosition(entry.doctor_id, entry.priority, entry.joined_at);

    return {
        queueEntry: entry,
        position,
    };
}

export async function getMyDoctorQueueService(doctorId: string) {
    return getQueueService({ doctorId });
}
