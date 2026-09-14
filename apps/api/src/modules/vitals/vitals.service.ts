import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { updateVisitStatusService } from "#modules/visits/visits.service.js";
import type { RecordVitalsInput } from "./vitals.schema.js";

function formatVitalsRow(row: any) {
    if (!row) return null;
    return {
        ...row,
        height: row.height_cm,
        height_cm: row.height_cm,
        weight: row.weight_kg,
        weight_kg: row.weight_kg,
        blood_pressure: row.blood_pressure,
        temperature: row.temperature_c,
        temperature_c: row.temperature_c,
        heart_rate: row.pulse_bpm,
        pulse_bpm: row.pulse_bpm,
        oxygen_saturation: row.spo2_percent,
        spo2_percent: row.spo2_percent,
        created_at: row.recorded_at,
        recorded_at: row.recorded_at,
    };
}

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

    // Resolve recorded_by to staff_profiles.id
    let recordedByStaffId: string | null = null;
    if (authUser?.userId) {
        const staffLookup = await pool.query<{ id: string }>(
            'SELECT id FROM "staff_profiles" WHERE user_id = $1 OR id = $1',
            [authUser.userId]
        );
        if (staffLookup.rowCount && staffLookup.rows[0]) {
            recordedByStaffId = staffLookup.rows[0].id;
        }
    }

    const heightCm = data.height_cm ?? data.height ?? null;
    const weightKg = data.weight_kg ?? data.weight ?? null;
    const bloodPressure = data.bloodPressure ?? data.blood_pressure ?? null;
    const temperatureC = data.temperature_c ?? data.temperature ?? null;
    const pulseBpm = data.pulse_bpm ?? data.heartRate ?? data.heart_rate ?? null;
    const spo2Percent = data.spo2_percent ?? data.oxygenSaturation ?? data.oxygen_saturation ?? null;

    const insertRes = await pool.query(
        `INSERT INTO "vitals" (
            visit_id,
            recorded_by,
            height_cm,
            weight_kg,
            blood_pressure,
            temperature_c,
            pulse_bpm,
            spo2_percent
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
            visitId,
            recordedByStaffId,
            heightCm,
            weightKg,
            bloodPressure,
            temperatureC,
            pulseBpm,
            spo2Percent,
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

    return formatVitalsRow(insertRes.rows[0]);
}

export async function getVitalsByVisitService(visitId: string) {
    const res = await pool.query(
        `SELECT v.*, u.name as recorded_by_name
         FROM "vitals" v
         LEFT JOIN "staff_profiles" sp ON v.recorded_by = sp.id
         LEFT JOIN "users" u ON sp.user_id = u.id
         WHERE v.visit_id = $1
         ORDER BY v.recorded_at ASC`,
        [visitId]
    );
    return res.rows.map(formatVitalsRow);
}

export async function getVitalsByIdService(id: string) {
    const res = await pool.query(
        `SELECT v.*, u.name as recorded_by_name
         FROM "vitals" v
         LEFT JOIN "staff_profiles" sp ON v.recorded_by = sp.id
         LEFT JOIN "users" u ON sp.user_id = u.id
         WHERE v.id = $1`,
        [id]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Vitals record not found", 404);
    }

    return formatVitalsRow(res.rows[0]);
}
