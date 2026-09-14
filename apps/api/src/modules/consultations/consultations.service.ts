import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { createVisitService } from "#modules/visits/visits.service.js";
import type { CreateConsultationInput, UpdateConsultationInput } from "./consultations.schema.js";

export async function createConsultationService(
    doctorId: string,
    patientId: string,
    data: CreateConsultationInput,
    authUser?: AuthPayload
) {
    const patientRes = await pool.query<{ id: string; user_id: string }>(
        'SELECT id, owner_user_id as user_id FROM "patient_profiles" WHERE id = $1',
        [patientId]
    );
    if (patientRes.rowCount === 0 || !patientRes.rows[0]) {
        throw new AppError("Patient not found", 404);
    }

    let visitId = data.visitId || data.visit_id || null;
    const appointmentId = data.appointmentId || data.appointment_id || null;

    // 1. Try to find active visit linked to the appointment
    if (!visitId && appointmentId) {
        const vRes = await pool.query<{ id: string }>(
            'SELECT id FROM "visits" WHERE appointment_id = $1 AND status NOT IN (\'COMPLETED\', \'CANCELLED\') LIMIT 1',
            [appointmentId]
        );
        if (vRes.rowCount && vRes.rows[0]) {
            visitId = vRes.rows[0].id;
        }
    }

    // 2. Try to find patient active visit
    if (!visitId) {
        const vRes = await pool.query<{ id: string }>(
            'SELECT id FROM "visits" WHERE patient_id = $1 AND status NOT IN (\'COMPLETED\', \'CANCELLED\') ORDER BY created_at DESC LIMIT 1',
            [patientId]
        );
        if (vRes.rowCount && vRes.rows[0]) {
            visitId = vRes.rows[0].id;
        }
    }

    // 3. If no active visit exists, create one
    if (!visitId) {
        let validUserId = patientRes.rows[0].user_id;
        if (authUser?.userId) {
            const userCheck = await pool.query<{ id: string }>(
                'SELECT id FROM "users" WHERE id = $1',
                [authUser.userId]
            );
            if (userCheck.rowCount) {
                validUserId = authUser.userId;
            }
        }

        // The authenticated doctor is creating the visit on behalf of the
        // patient (clinical workflow), so act as STAFF to bypass the
        // patient-ownership check in createVisitService.
        const callerAuth: AuthPayload = {
            userId: authUser?.userId || validUserId || "system",
            email: authUser?.email || "system@hospital.internal",
            role: "STAFF",
        };

        const createdVisit = await createVisitService(
            {
                patientId,
                visitType: appointmentId ? "APPOINTMENT" : "OPD",
                appointmentId: appointmentId ?? null,
                assignedDoctorId: doctorId,
                departmentId: null,
                registeredBy: validUserId,
            },
            callerAuth
        );
        visitId = createdVisit.id;
    }

    const treatmentPlan = data.treatmentPlan || data.treatment_plan || null;

    const consultRes = await pool.query(
        `INSERT INTO "consultations" (
            doctor_id,
            appointment_id,
            visit_id,
            diagnosis,
            notes,
            treatment_plan
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
            doctorId,
            appointmentId,
            visitId,
            data.diagnosis,
            data.notes ?? null,
            treatmentPlan,
        ]
    );

    const consultation = consultRes.rows[0];
    const createdPrescriptions: unknown[] = [];

    if (data.prescriptions && data.prescriptions.length > 0) {
        for (const item of data.prescriptions) {
            const presRes = await pool.query(
                `INSERT INTO "prescriptions" (
                    consultation_id,
                    doctor_id,
                    visit_id,
                    medication,
                    dosage,
                    frequency,
                    duration,
                    instructions,
                    status
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
                 RETURNING *`,
                [
                    consultation.id,
                    doctorId,
                    visitId,
                    item.medication,
                    item.dosage,
                    item.frequency ?? null,
                    item.duration ?? null,
                    item.instructions ?? null,
                ]
            );
            createdPrescriptions.push({
                ...presRes.rows[0],
                patient_id: patientId,
                patientId,
            });
        }
    }

    return {
        ...consultation,
        patient_id: patientId,
        patientId,
        prescriptions: createdPrescriptions,
    };
}

export async function updateConsultationService(
    doctorId: string,
    consultationId: string,
    data: UpdateConsultationInput
) {
    const consultRes = await pool.query(
        'SELECT id, doctor_id, diagnosis, notes, treatment_plan, visit_id FROM "consultations" WHERE id = $1',
        [consultationId]
    );

    if (consultRes.rowCount === 0 || !consultRes.rows[0]) {
        throw new AppError("Consultation not found", 404);
    }

    const existing = consultRes.rows[0];
    if (existing.doctor_id !== doctorId) {
        throw new AppError("You are not authorized to update this consultation", 403);
    }

    const treatmentPlan = data.treatmentPlan || data.treatment_plan || existing.treatment_plan;

    const updateRes = await pool.query(
        `UPDATE "consultations"
         SET diagnosis = $1,
             notes = $2,
             treatment_plan = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [
            data.diagnosis ?? existing.diagnosis,
            data.notes ?? existing.notes,
            treatmentPlan,
            consultationId,
        ]
    );

    return updateRes.rows[0];
}

export async function getConsultationByIdService(consultationId: string) {
    const res = await pool.query(
        `SELECT 
            c.*, 
            v.patient_id,
            p.name as patient_name, 
            u.name as doctor_name
         FROM "consultations" c
         JOIN "visits" v ON c.visit_id = v.id
         JOIN "patient_profiles" p ON v.patient_id = p.id
         LEFT JOIN "doctors" d ON c.doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" u ON s.user_id = u.id
         WHERE c.id = $1`,
        [consultationId]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Consultation not found", 404);
    }

    const presRes = await pool.query(
        'SELECT * FROM "prescriptions" WHERE consultation_id = $1 ORDER BY created_at ASC',
        [consultationId]
    );

    return {
        ...res.rows[0],
        prescriptions: presRes.rows,
    };
}

export async function getConsultationsByVisitService(visitId: string) {
    const res = await pool.query(
        `SELECT 
            c.*, 
            u.name as doctor_name
         FROM "consultations" c
         LEFT JOIN "doctors" d ON c.doctor_id = d.id
         LEFT JOIN "staff_profiles" s ON d.staff_id = s.id
         LEFT JOIN "users" u ON s.user_id = u.id
         WHERE c.visit_id = $1
         ORDER BY c.created_at ASC`,
        [visitId]
    );
    return res.rows;
}
