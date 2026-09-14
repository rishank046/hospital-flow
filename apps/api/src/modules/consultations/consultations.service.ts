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
    const patientRes = await pool.query<{ id: string; owner_user_id: string }>(
        'SELECT id, owner_user_id FROM "Patient" WHERE id = $1',
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
        `INSERT INTO "Consultation" (
            doctor_id,
            patient_id,
            appointment_id,
            visit_id,
            diagnosis,
            notes,
            treatment_plan
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            doctorId,
            patientId,
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
                `INSERT INTO "Prescription" (
                    consultation_id,
                    patient_id,
                    doctor_id,
                    visit_id,
                    medication,
                    dosage,
                    frequency,
                    duration,
                    instructions,
                    status
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
                 RETURNING *`,
                [
                    consultation.id,
                    patientId,
                    doctorId,
                    visitId,
                    item.medication,
                    item.dosage,
                    item.frequency ?? null,
                    item.duration ?? null,
                    item.instructions ?? null,
                ]
            );
            createdPrescriptions.push(presRes.rows[0]);
        }
    }

    return {
        ...consultation,
        prescriptions: createdPrescriptions,
    };
}

export async function updateConsultationService(
    doctorId: string,
    consultationId: string,
    data: UpdateConsultationInput
) {
    const consultRes = await pool.query(
        'SELECT id, doctor_id, diagnosis, notes, treatment_plan, visit_id FROM "Consultation" WHERE id = $1',
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
        `UPDATE "Consultation"
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
        `SELECT c.*, p.name as patient_name, COALESCE(u.name, d.name) as doctor_name
         FROM "Consultation" c
         JOIN "Patient" p ON c.patient_id = p.id
         LEFT JOIN "Doctor" d ON c.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         WHERE c.id = $1`,
        [consultationId]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Consultation not found", 404);
    }

    const presRes = await pool.query(
        'SELECT * FROM "Prescription" WHERE consultation_id = $1 ORDER BY created_at ASC',
        [consultationId]
    );

    return {
        ...res.rows[0],
        prescriptions: presRes.rows,
    };
}

export async function getConsultationsByVisitService(visitId: string) {
    const res = await pool.query(
        `SELECT c.*, COALESCE(u.name, d.name) as doctor_name
         FROM "Consultation" c
         LEFT JOIN "Doctor" d ON c.doctor_id = d.id
         LEFT JOIN "Staff" s ON d.staff_id = s.id
         LEFT JOIN "User" u ON s.user_id = u.id
         WHERE c.visit_id = $1
         ORDER BY c.created_at ASC`,
        [visitId]
    );
    return res.rows;
}
