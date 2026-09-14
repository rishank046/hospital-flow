import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import type { DispensePrescriptionInput, PrescriptionFilterQuery } from "./prescriptions.schema.js";

export async function dispensePrescriptionService(
    prescriptionId: string,
    data: DispensePrescriptionInput,
    authUser?: AuthPayload
) {
    const prescRes = await pool.query(
        'SELECT * FROM "Prescription" WHERE id = $1',
        [prescriptionId]
    );

    if (prescRes.rowCount === 0 || !prescRes.rows[0]) {
        throw new AppError("Prescription not found", 404);
    }

    const prescription = prescRes.rows[0];

    const quantity = data.quantity ?? 1;
    let dispensedBy = authUser?.userId ?? null;
    if (dispensedBy) {
        const uCheck = await pool.query('SELECT id FROM "User" WHERE id = $1', [dispensedBy]);
        if (uCheck.rowCount === 0) {
            dispensedBy = null;
        }
    }

    const dispenseRes = await pool.query(
        `INSERT INTO "pharmacy_dispenses" (prescription_id, dispensed_by, dispensed_quantity, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [prescriptionId, dispensedBy, quantity, data.notes ?? null]
    );

    const updateRes = await pool.query(
        `UPDATE "Prescription"
         SET status = 'DISPENSED'
         WHERE id = $1
         RETURNING *`,
        [prescriptionId]
    );

    return {
        prescription: updateRes.rows[0],
        dispense: dispenseRes.rows[0],
    };
}

export async function getPrescriptionsService(filter: PrescriptionFilterQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.patientId) {
        params.push(filter.patientId);
        conditions.push(`pr.patient_id = $${params.length}`);
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
            p.name as patient_name,
            COALESCE(u.name, d.name) as doctor_name
        FROM "Prescription" pr
        JOIN "Patient" p ON pr.patient_id = p.id
        LEFT JOIN "Doctor" d ON pr.doctor_id = d.id
        LEFT JOIN "Staff" s ON d.staff_id = s.id
        LEFT JOIN "User" u ON s.user_id = u.id
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
            p.name as patient_name,
            COALESCE(u.name, d.name) as doctor_name
         FROM "Prescription" pr
         JOIN "Patient" p ON pr.patient_id = p.id
         LEFT JOIN "Doctor" d ON pr.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         WHERE pr.id = $1`,
        [id]
    );

    if (prescRes.rowCount === 0 || !prescRes.rows[0]) {
        throw new AppError("Prescription not found", 404);
    }

    const dispensesRes = await pool.query(
        `SELECT pd.*, u.name as dispensed_by_name
         FROM "pharmacy_dispenses" pd
         LEFT JOIN "User" u ON pd.dispensed_by = u.id
         WHERE pd.prescription_id = $1
         ORDER BY pd.created_at DESC`,
        [id]
    );

    return {
        ...prescRes.rows[0],
        dispenses: dispensesRes.rows,
    };
}
