import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { updateVisitStatusService } from "#modules/visits/visits.service.js";
import type { RecordVitalsInput } from "./vitals.schema.js";

export async function recordVitalsService(
    visitId: string,
    data: RecordVitalsInput,
    authUser?: AuthPayload
) {
    const visitRes = await pool.query<{ id: string; patient_id: string; status: string }>(
        'SELECT id, patient_id, status FROM "visits" WHERE id = $1',
        [visitId]
    );

    if (visitRes.rowCount === 0 || !visitRes.rows[0]) {
        throw new AppError("Visit not found", 404);
    }

    const visit = visitRes.rows[0];
    const recordedBy = authUser?.userId ?? null;

    const heartRate = data.heartRate ?? data.heart_rate ?? null;
    const bloodPressure = data.bloodPressure ?? data.blood_pressure ?? null;
    const respiratoryRate = data.respiratoryRate ?? data.respiratory_rate ?? null;
    const oxygenSaturation = data.oxygenSaturation ?? data.oxygen_saturation ?? null;

    const insertRes = await pool.query(
        `INSERT INTO "vitals" (
            visit_id,
            patient_id,
            recorded_by,
            temperature,
            heart_rate,
            blood_pressure,
            respiratory_rate,
            oxygen_saturation,
            weight,
            height,
            notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
            visitId,
            visit.patient_id,
            recordedBy,
            data.temperature ?? null,
            heartRate,
            bloodPressure,
            respiratoryRate,
            oxygenSaturation,
            data.weight ?? null,
            data.height ?? null,
            data.notes ?? null,
        ]
    );

    // Transition visit to VITALS if currently REGISTERED
    if (visit.status === "REGISTERED") {
        const transitionAuth: AuthPayload = {
            userId: authUser?.userId || "system",
            email: authUser?.email || "system@hospital.internal",
            role: "STAFF",
            staffRole: (authUser?.staffRole as any) || "NURSE",
        };
        await updateVisitStatusService(visitId, "VITALS", transitionAuth);
    }

    return insertRes.rows[0];
}

export async function getVitalsByVisitService(visitId: string) {
    const res = await pool.query(
        `SELECT v.*, u.name as recorded_by_name
         FROM "vitals" v
         LEFT JOIN "User" u ON v.recorded_by = u.id
         WHERE v.visit_id = $1
         ORDER BY v.created_at ASC`,
        [visitId]
    );
    return res.rows;
}

export async function getVitalsByIdService(id: string) {
    const res = await pool.query(
        `SELECT v.*, u.name as recorded_by_name
         FROM "vitals" v
         LEFT JOIN "User" u ON v.recorded_by = u.id
         WHERE v.id = $1`,
        [id]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Vitals record not found", 404);
    }

    return res.rows[0];
}
