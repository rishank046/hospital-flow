import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { calculateQueuePosition } from "#modules/queue/queue.service.js";
import type {
    CheckAvailabilityQuery,
    CreateAppointmentInput,
    ListAppointmentsQuery,
} from "./appointments.schema.js";

export async function bookAppointmentService(
    data: CreateAppointmentInput,
    authUser?: AuthPayload
) {
    const patientId = data.patientId || data.patient_id;
    const doctorId = data.doctorId || data.doctor_id;

    if (!patientId || !doctorId) {
        throw new AppError("patientId and doctorId are required", 400);
    }

    // 1. Verify patient exists
    const patientRes = await pool.query<{ id: string; owner_user_id: string }>(
        'SELECT id, owner_user_id FROM "patient_profiles" WHERE id = $1',
        [patientId]
    );
    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient profile not found", 404);
    }

    // If caller is patient, check ownership
    if (authUser?.role === "USER" && patientRes.rows[0].owner_user_id !== authUser.userId) {
        throw new AppError("Forbidden: cannot book appointment for another user's patient profile", 403);
    }

    // 2. Verify doctor exists and retrieve consultation length
    const docRes = await pool.query<{
        id: string;
        specialization: string;
        consultation_minutes: number;
        doctor_name: string;
    }>(
        `SELECT d.id, d.specialization, COALESCE(d.consultation_minutes, 15) as consultation_minutes, u.name as doctor_name
         FROM "doctors" d
         JOIN "staff_profiles" s ON d.staff_id = s.id
         JOIN "users" u ON s.user_id = u.id
         WHERE d.id = $1`,
        [doctorId]
    );

    if (docRes.rowCount === 0 || !docRes.rows[0]) {
        throw new AppError("Doctor not found", 404);
    }

    const doctor = docRes.rows[0];
    const consultationMinutes = Number(doctor.consultation_minutes) || 15;

    // 3. Resolve start and end times
    const rawStart = data.startTime || data.start_time;
    if (!rawStart) {
        throw new AppError("startTime is required", 400);
    }

    const startTime = new Date(rawStart);
    if (Number.isNaN(startTime.getTime())) {
        throw new AppError("Invalid startTime format", 400);
    }

    let endTime: Date;
    const rawEnd = data.endTime || data.end_time;
    if (rawEnd) {
        endTime = new Date(rawEnd);
        if (Number.isNaN(endTime.getTime())) {
            throw new AppError("Invalid endTime format", 400);
        }
    } else {
        endTime = new Date(startTime.getTime() + consultationMinutes * 60 * 1000);
    }

    if (startTime >= endTime) {
        throw new AppError("Appointment end time must be after start time", 400);
    }

    // 4. CONFLICT PROTECTION & OVERLAP PREVENTION
    // Check doctor schedule overlap
    const docOverlapRes = await pool.query<{ id: string; start_time: Date; end_time: Date }>(
        `SELECT id, start_time, end_time
         FROM "appointments"
         WHERE doctor_id = $1
           AND status NOT IN ('CANCELLED', 'NO_SHOW')
           AND (start_time < $3 AND end_time > $2)
         LIMIT 1`,
        [doctorId, startTime, endTime]
    );

    if (docOverlapRes.rowCount && docOverlapRes.rowCount > 0) {
        throw new AppError(
            `Doctor conflict: Dr. ${doctor.doctor_name} is already booked for an appointment during this time window`,
            409
        );
    }

    // Check patient schedule overlap
    const patOverlapRes = await pool.query<{ id: string; start_time: Date; end_time: Date }>(
        `SELECT id, start_time, end_time
         FROM "appointments"
         WHERE patient_id = $1
           AND status NOT IN ('CANCELLED', 'NO_SHOW')
           AND (start_time < $3 AND end_time > $2)
         LIMIT 1`,
        [patientId, startTime, endTime]
    );

    if (patOverlapRes.rowCount && patOverlapRes.rowCount > 0) {
        throw new AppError(
            "Patient conflict: The patient already has another appointment scheduled during this time window",
            409
        );
    }

    // 5. Insert appointment
    const insertRes = await pool.query(
        `INSERT INTO "appointments" (
            patient_id,
            doctor_id,
            start_time,
            end_time,
            type,
            status
         )
         VALUES ($1, $2, $3, $4, $5, 'SCHEDULED')
         RETURNING *`,
        [
            patientId,
            doctorId,
            startTime,
            endTime,
            data.type || "CONSULTATION",
        ]
    );

    const created = insertRes.rows[0];

    return {
        ...created,
        doctor_name: doctor.doctor_name,
        specialization: doctor.specialization,
        consultation_minutes: consultationMinutes,
    };
}

export async function getDoctorAvailabilityService(
    doctorId: string,
    dateStr: string
) {
    const docRes = await pool.query<{
        id: string;
        specialization: string;
        consultation_minutes: number;
        doctor_name: string;
    }>(
        `SELECT d.id, d.specialization, COALESCE(d.consultation_minutes, 15) as consultation_minutes, u.name as doctor_name
         FROM "doctors" d
         JOIN "staff_profiles" s ON d.staff_id = s.id
         JOIN "users" u ON s.user_id = u.id
         WHERE d.id = $1`,
        [doctorId]
    );

    if (docRes.rowCount === 0 || !docRes.rows[0]) {
        throw new AppError("Doctor not found", 404);
    }

    const doctor = docRes.rows[0];
    const consultationMinutes = Number(doctor.consultation_minutes) || 15;

    // Day bounds: 09:00:00 to 17:00:00 on the specified date
    const dayStart = new Date(`${dateStr}T09:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T17:00:00.000Z`);

    if (Number.isNaN(dayStart.getTime())) {
        throw new AppError("Invalid date format: expected YYYY-MM-DD", 400);
    }

    // Fetch existing non-cancelled appointments for this doctor on that day
    const apptsRes = await pool.query<{
        id: string;
        start_time: Date;
        end_time: Date;
        status: string;
    }>(
        `SELECT id, start_time, end_time, status
         FROM "appointments"
         WHERE doctor_id = $1
           AND status NOT IN ('CANCELLED', 'NO_SHOW')
           AND start_time >= $2 AND start_time < $3
         ORDER BY start_time ASC`,
        [doctorId, dayStart, dayEnd]
    );

    const existingAppts = apptsRes.rows;
    const slots: Array<{
        startTime: string;
        endTime: string;
        timeLabel: string;
        available: boolean;
        reason?: string;
    }> = [];

    const slotMs = consultationMinutes * 60 * 1000;
    let currentSlotTime = dayStart.getTime();
    const endMs = dayEnd.getTime();

    while (currentSlotTime + slotMs <= endMs) {
        const slotStart = new Date(currentSlotTime);
        const slotEnd = new Date(currentSlotTime + slotMs);

        // Check if any appointment overlaps with [slotStart, slotEnd]
        const hasOverlap = existingAppts.some((appt) => {
            const apptStart = new Date(appt.start_time).getTime();
            const apptEnd = new Date(appt.end_time).getTime();
            return apptStart < slotEnd.getTime() && apptEnd > slotStart.getTime();
        });

        const startLabel = slotStart.toISOString().substring(11, 16);
        const endLabel = slotEnd.toISOString().substring(11, 16);

        slots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            timeLabel: `${startLabel} - ${endLabel}`,
            available: !hasOverlap,
            ...(hasOverlap ? { reason: "Booked" } : {}),
        });

        currentSlotTime += slotMs;
    }

    return {
        doctorId,
        doctorName: doctor.doctor_name,
        specialization: doctor.specialization,
        date: dateStr,
        consultationMinutes,
        totalSlots: slots.length,
        availableSlots: slots.filter((s) => s.available).length,
        slots,
    };
}

export async function checkInAppointmentService(
    appointmentId: string,
    _authUser?: AuthPayload
) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const apptRes = await client.query(
            `SELECT a.*, p.owner_user_id, u.name as doctor_name
             FROM "appointments" a
             JOIN "patient_profiles" p ON a.patient_id = p.id
             JOIN "doctors" d ON a.doctor_id = d.id
             JOIN "staff_profiles" s ON d.staff_id = s.id
             JOIN "users" u ON s.user_id = u.id
             WHERE a.id = $1`,
            [appointmentId]
        );

        if (apptRes.rowCount === 0 || !apptRes.rows[0]) {
            throw new AppError("Appointment not found", 404);
        }

        const appt = apptRes.rows[0];

        if (appt.status === "CANCELLED") {
            throw new AppError("Cancelled appointments cannot be checked in", 400);
        }

        // If already checked in, check if visit exists
        if (appt.status === "CHECKED_IN") {
            const existingVisit = await client.query(
                'SELECT * FROM "visits" WHERE appointment_id = $1',
                [appointmentId]
            );
            if (existingVisit.rowCount && existingVisit.rows[0]) {
                const visit = existingVisit.rows[0];
                const queueEntry = await client.query(
                    'SELECT * FROM "queue_entries" WHERE visit_id = $1',
                    [visit.id]
                );
                await client.query("COMMIT");
                return {
                    appointment: appt,
                    visit,
                    queueEntry: queueEntry.rows[0] || null,
                    message: "Appointment already checked in",
                };
            }
        }

        // 1. Mark appointment as CHECKED_IN
        const updateAppt = await client.query(
            `UPDATE "appointments"
             SET status = 'CHECKED_IN',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [appointmentId]
        );

        // 2. Automated visit creation linked to this appointment
        const insertVisit = await client.query(
            `INSERT INTO "visits" (
                patient_id,
                appointment_id,
                assigned_doctor_id,
                visit_type,
                status
             )
             VALUES ($1, $2, $3, 'ONLINE', 'WAITING_OPD')
             RETURNING *`,
            [
                appt.patient_id,
                appointmentId,
                appt.doctor_id,
            ]
        );

        const createdVisit = insertVisit.rows[0];

        // 3. Automated queue entry creation
        const insertQueue = await client.query(
            `INSERT INTO "queue_entries" (
                visit_id,
                doctor_id,
                queue_type,
                priority,
                status,
                joined_at
             )
             VALUES ($1, $2, 'APPOINTMENT', 1, 'WAITING', CURRENT_TIMESTAMP)
             RETURNING *`,
            [
                createdVisit.id,
                appt.doctor_id,
            ]
        );

        const createdQueueEntry = insertQueue.rows[0];

        await client.query("COMMIT");

        const position = await calculateQueuePosition(
            createdQueueEntry.doctor_id,
            createdQueueEntry.priority,
            createdQueueEntry.joined_at
        );

        return {
            appointment: updateAppt.rows[0],
            visit: createdVisit,
            queueEntry: {
                ...createdQueueEntry,
                position,
            },
            position,
            message: "Appointment checked in; visit and queue entry created successfully",
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function cancelAppointmentService(
    appointmentId: string,
    authUser?: AuthPayload
) {
    const apptRes = await pool.query<{ id: string; patient_id: string; owner_user_id: string }>(
        `SELECT a.id, a.patient_id, p.owner_user_id
         FROM "appointments" a
         JOIN "patient_profiles" p ON a.patient_id = p.id
         WHERE a.id = $1`,
        [appointmentId]
    );

    if (apptRes.rowCount === 0 || !apptRes.rows[0]) {
        throw new AppError("Appointment not found", 404);
    }

    const appt = apptRes.rows[0];

    if (authUser?.role === "USER" && appt.owner_user_id !== authUser.userId) {
        throw new AppError("Forbidden: cannot cancel another user's appointment", 403);
    }

    await pool.query(
        `UPDATE "appointments"
         SET status = 'CANCELLED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [appointmentId]
    );

    // Cancel any waiting queue entry linked to this appointment's visit
    await pool.query(
        `UPDATE "queue_entries"
         SET status = 'CANCELLED'
         WHERE visit_id IN (SELECT id FROM "visits" WHERE appointment_id = $1)
           AND status = 'WAITING'`,
        [appointmentId]
    );

    return { message: "Appointment cancelled successfully" };
}

export async function listAppointmentsService(
    filter: ListAppointmentsQuery,
    _authUser?: AuthPayload
) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.patientId) {
        params.push(filter.patientId);
        conditions.push(`a.patient_id = $${params.length}`);
    }

    if (filter.doctorId) {
        params.push(filter.doctorId);
        conditions.push(`a.doctor_id = $${params.length}`);
    }

    if (filter.status) {
        params.push(filter.status);
        conditions.push(`a.status = $${params.length}`);
    }

    if (filter.date) {
        const dayStart = new Date(`${filter.date}T00:00:00.000Z`);
        const dayEnd = new Date(`${filter.date}T23:59:59.999Z`);
        params.push(dayStart);
        conditions.push(`a.start_time >= $${params.length}`);
        params.push(dayEnd);
        conditions.push(`a.start_time <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            a.*,
            p.name as patient_name,
            p.gender as patient_gender,
            u.name as doctor_name,
            d.specialization,
            COALESCE(d.consultation_minutes, 15) as consultation_minutes
        FROM "appointments" a
        JOIN "patient_profiles" p ON a.patient_id = p.id
        JOIN "doctors" d ON a.doctor_id = d.id
        JOIN "staff_profiles" s ON d.staff_id = s.id
        JOIN "users" u ON s.user_id = u.id
        ${whereClause}
        ORDER BY a.start_time ASC
    `;

    const res = await pool.query(query, params);
    return { appointments: res.rows };
}
