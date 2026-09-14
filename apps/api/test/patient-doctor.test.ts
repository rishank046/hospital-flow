import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";

let server: http.Server;
let baseUrl: string;

let doctorToken: string;
let doctorId: string;
const doctorEmail = `doc_${Date.now()}@example.com`;
const doctorPassword = "doctorPassword123";

let patientToken: string;
let userId: string;
let patientId: string;
const patientEmail = `pat_${Date.now()}@example.com`;
const patientPassword = "patientPassword123";
const jwtSecret = process.env.JWT_SECRET;

let adminToken: string;
let adminId: string;
const adminEmail = `admin_${Date.now()}@example.com`;
const adminPassword = "adminPassword123!";

let otherUserToken: string;
let otherUserId: string;
const otherUserEmail = `other_${Date.now()}@example.com`;

let secondPatientId: string;
let walkInQueueEntryId: string;
let emergencyQueueEntryId: string;

let createdStaffId: string;
let createdStaffUserId: string;
let nurseToken: string;
const nurseEmail = `nurse_${Date.now()}@example.com`;
const nursePassword = "NursePassword123!";

let autoPassStaffId: string;
let autoPassStaffUserId: string;
let autoPassTemporaryPassword: string;
const autoPassStaffEmail = `autopass_staff_${Date.now()}@example.com`;

let adminCreatedDocStaffId: string;
let adminCreatedDocStaffUserId: string;
const adminCreatedDocStaffEmail = `admin_created_doc_${Date.now()}@example.com`;

let createdAdminDoctorId: string;
let createdAdminDoctorUserId: string;
const newDocEmail = `doc_admin_${Date.now()}@example.com`;
const newDocPassword = "NewDoctorPassword123!";

let regPatientEmail: string;

let createdAppointmentId: string;
let createdConsultationId: string;

beforeAll(async () => {

    // Start ephemeral server
    await new Promise<void>((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
            const addr = server.address();
            if (addr && typeof addr === "object") {
                baseUrl = `http://localhost:${addr.port}`;
            }
            resolve();
        });
    });

    if (!jwtSecret) {
        throw new Error("JWT_SECRET must be set for tests");
    }

    // Seed a Doctor (User -> Staff -> Doctor)
    const hashedPassword = await bcrypt.hash(doctorPassword, 10);
    const docUserRes = await pool.query(
        `INSERT INTO "users" (name, email, password, role)
         VALUES ($1, $2, $3, 'STAFF')
         RETURNING id, name, email`,
        ["Dr. Sarah Connor", doctorEmail, hashedPassword]
    );
    const doctorUserId = docUserRes.rows[0].id;

    // Find or create Department
    let deptId: string | null = null;
    const deptRes = await pool.query<{ id: string }>(
        'SELECT id FROM "departments" WHERE name ILIKE $1',
        ["Cardiology Department"]
    );
    if (deptRes.rowCount && deptRes.rows[0]) {
        deptId = deptRes.rows[0].id;
    } else {
        const newDept = await pool.query<{ id: string }>(
            'INSERT INTO "departments" (name) VALUES ($1) RETURNING id',
            ["Cardiology Department"]
        );
        deptId = newDept.rows[0]?.id ?? null;
    }

    const docStaffRes = await pool.query(
        `INSERT INTO "staff_profiles" (user_id, employee_code, staff_role, department_id, status)
         VALUES ($1, $2, 'DOCTOR', $3, 'ACTIVE')
         RETURNING id`,
        [doctorUserId, `DOC-PD-${Date.now()}`, deptId]
    );
    const doctorStaffId = docStaffRes.rows[0].id;

    const docRes = await pool.query(
        `INSERT INTO "doctors" (staff_id, specialization, license_number)
         VALUES ($1, 'Cardiology', $2)
         RETURNING id`,
        [doctorStaffId, `LIC-PD-${Date.now()}`]
    );
    doctorId = docRes.rows[0].id;

    // Seed a User
    const hashedPatientPassword = await bcrypt.hash(patientPassword, 10);
    const userRes = await pool.query(
        `INSERT INTO "users" (name, email, password, role)
         VALUES ($1, $2, $3, 'USER')
         RETURNING id, name, email`,
        ["John Connor", patientEmail, hashedPatientPassword]
    );
    userId = userRes.rows[0].id;

    // Seed a Patient record
    const patRes = await pool.query(
        `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender)
         VALUES ($1, 'John Connor', '1989-01-01', 'Male')
         RETURNING id`,
        [userId]
    );
    patientId = patRes.rows[0].id;

    // Patient JWT
    patientToken = jwt.sign(
        { userId, email: patientEmail, role: "USER" },
        jwtSecret,
        { expiresIn: "4h" }
    );

    // Seed an Admin
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    const adminRes = await pool.query(
        `INSERT INTO "users" (name, email, password, role)
         VALUES ($1, $2, $3, 'ADMIN')
         RETURNING id, name, email`,
        ["System Administrator", adminEmail, hashedAdminPassword]
    );
    adminId = adminRes.rows[0].id;
    adminToken = jwt.sign(
        { userId: adminId, email: adminEmail, role: "ADMIN" },
        jwtSecret,
        { expiresIn: "4h" }
    );

    // Seed another User for ownership & authorization checks
    const otherUserRes = await pool.query(
        `INSERT INTO "users" (name, email, password, role)
         VALUES ($1, $2, $3, 'USER')
         RETURNING id, name, email`,
        ["Jane Smith", otherUserEmail, hashedPatientPassword]
    );
    otherUserId = otherUserRes.rows[0].id;
    otherUserToken = jwt.sign(
        { userId: otherUserId, email: otherUserEmail, role: "PATIENT" },
        jwtSecret,
        { expiresIn: "4h" }
    );
});

afterAll(async () => {
    // Cleanup any created queue entries
    if (doctorId) {
        await pool.query('DELETE FROM "queue_entries" WHERE doctor_id = $1', [doctorId]);
    }
    if (createdAdminDoctorId) {
        await pool.query('DELETE FROM "queue_entries" WHERE doctor_id = $1', [createdAdminDoctorId]);
        await pool.query('DELETE FROM "doctors" WHERE id = $1', [createdAdminDoctorId]);
    }
    if (createdAdminDoctorUserId) {
        await pool.query('DELETE FROM "staff_profiles" WHERE user_id = $1', [createdAdminDoctorUserId]);
        await pool.query('DELETE FROM "users" WHERE id = $1', [createdAdminDoctorUserId]);
    }
    if (createdStaffUserId) {
        await pool.query('DELETE FROM "nurses" WHERE staff_id IN (SELECT id FROM "staff_profiles" WHERE user_id = $1)', [createdStaffUserId]);
        await pool.query('DELETE FROM "staff_profiles" WHERE user_id = $1', [createdStaffUserId]);
        await pool.query('DELETE FROM "users" WHERE id = $1', [createdStaffUserId]);
    }
    if (autoPassStaffUserId) {
        await pool.query('DELETE FROM "staff_profiles" WHERE user_id = $1', [autoPassStaffUserId]);
        await pool.query('DELETE FROM "users" WHERE id = $1', [autoPassStaffUserId]);
    }
    if (adminCreatedDocStaffUserId) {
        await pool.query('DELETE FROM "doctors" WHERE staff_id IN (SELECT id FROM "staff_profiles" WHERE user_id = $1)', [adminCreatedDocStaffUserId]);
        await pool.query('DELETE FROM "staff_profiles" WHERE user_id = $1', [adminCreatedDocStaffUserId]);
        await pool.query('DELETE FROM "users" WHERE id = $1', [adminCreatedDocStaffUserId]);
    }
    if (secondPatientId) {
        await pool.query('DELETE FROM "queue_entries" WHERE visit_id IN (SELECT id FROM "visits" WHERE patient_id = $1)', [secondPatientId]);
        await pool.query('DELETE FROM "patient_profiles" WHERE id = $1', [secondPatientId]);
    }
    if (patientId) {
        await pool.query('DELETE FROM "invoice_items" WHERE invoice_id IN (SELECT id FROM "invoices" WHERE patient_id = $1)', [patientId]);
        await pool.query('DELETE FROM "invoices" WHERE patient_id = $1', [patientId]);
        await pool.query('DELETE FROM "pharmacy_dispenses" WHERE prescription_id IN (SELECT id FROM "prescriptions" WHERE visit_id IN (SELECT id FROM "visits" WHERE patient_id = $1))', [patientId]);
        await pool.query('DELETE FROM "prescriptions" WHERE visit_id IN (SELECT id FROM "visits" WHERE patient_id = $1)', [patientId]);
        await pool.query('DELETE FROM "investigation_orders" WHERE visit_id IN (SELECT id FROM "visits" WHERE patient_id = $1)', [patientId]);
        await pool.query('DELETE FROM "consultations" WHERE visit_id IN (SELECT id FROM "visits" WHERE patient_id = $1)', [patientId]);
        await pool.query('DELETE FROM "queue_entries" WHERE visit_id IN (SELECT id FROM "visits" WHERE patient_id = $1)', [patientId]);
        await pool.query('DELETE FROM "vitals" WHERE visit_id IN (SELECT id FROM "visits" WHERE patient_id = $1)', [patientId]);
        await pool.query('DELETE FROM "visits" WHERE patient_id = $1', [patientId]);
        await pool.query('DELETE FROM "appointments" WHERE patient_id = $1', [patientId]);
        await pool.query('DELETE FROM "patient_profiles" WHERE id = $1', [patientId]);
    }
    if (userId) {
        await pool.query('DELETE FROM "patient_profiles" WHERE owner_user_id = $1', [userId]);
        await pool.query('DELETE FROM "users" WHERE id = $1', [userId]);
    }
    if (otherUserId) {
        await pool.query('DELETE FROM "patient_profiles" WHERE owner_user_id = $1', [otherUserId]);
        await pool.query('DELETE FROM "users" WHERE id = $1', [otherUserId]);
    }
    if (doctorId) {
        await pool.query('DELETE FROM "doctors" WHERE id = $1', [doctorId]);
    }
    if (adminId) {
        await pool.query('DELETE FROM "users" WHERE id = $1', [adminId]);
    }
    if (regPatientEmail) {
        await pool.query('DELETE FROM "patient_profiles" WHERE owner_user_id IN (SELECT id FROM "users" WHERE email = $1)', [regPatientEmail]);
        await pool.query('DELETE FROM "users" WHERE email = $1', [regPatientEmail]);
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));

    await pool.end();
});

describe("Doctor Authentication & Profile Flow", () => {
    it("POST /doctors/login - should authenticate doctor and return token", async () => {
        const res = await fetch(`${baseUrl}/doctors/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: doctorEmail,
                password: doctorPassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.doctor.email).toBe(doctorEmail);
        expect(data.doctor.name).toBe("Dr. Sarah Connor");

        doctorToken = data.token;
    });

    it("POST /doctors/login - should reject invalid credentials", async () => {
        const res = await fetch(`${baseUrl}/doctors/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: doctorEmail,
                password: "wrongPassword",
            }),
        });

        expect(res.status).toBe(401);
    });

    it("GET /doctors/me - should get doctor profile", async () => {
        const res = await fetch(`${baseUrl}/doctors/me`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.id).toBe(doctorId);
        expect(data.email).toBe(doctorEmail);
        expect(data).not.toHaveProperty("password");
    });

    it("PATCH /doctors/me - should update doctor profile", async () => {
        const res = await fetch(`${baseUrl}/doctors/me`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                department: "Advanced Cardiology",
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.department).toBe("Advanced Cardiology");
    });
});

describe("Patient Profile & Appointment Flow", () => {
    it("GET /patients/me - should retrieve patient profile", async () => {
        const res = await fetch(`${baseUrl}/patients/me`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.email).toBe(patientEmail);
        expect(data.name).toBe("John Connor");
    });

    it("PATCH /patients/me - should update patient profile", async () => {
        const res = await fetch(`${baseUrl}/patients/me`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                age: 36,
                patientType: "Online",
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.age).toBe(36);
    });

    it("POST /patients/appointments - should book an appointment with doctor", async () => {
        const startTime = new Date(Date.now() + 86400000).toISOString();
        const endTime = new Date(Date.now() + 86400000 + 1800000).toISOString();

        const res = await fetch(`${baseUrl}/patients/appointments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                doctorId,
                startTime,
                endTime,
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("id");
        expect(data.doctor_id).toBe(doctorId);

        createdAppointmentId = data.id;
    });

    it("GET /doctors/me/schedule - doctor should see the booked appointment", async () => {
        const res = await fetch(`${baseUrl}/doctors/me/schedule`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.schedule)).toBe(true);
        expect(data.schedule.some((s: any) => s.id === createdAppointmentId)).toBe(true);
    });

    it("GET /patients/me/appointments - patient should see booked appointment", async () => {
        const res = await fetch(`${baseUrl}/patients/me/appointments`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.appointments)).toBe(true);
        expect(data.appointments.some((a: any) => a.id === createdAppointmentId)).toBe(true);
    });
});

describe("Doctor Consultation & Prescriptions Flow", () => {
    it("POST /doctors/patients/:patientId/consultation - doctor creates consultation with prescriptions", async () => {
        const res = await fetch(`${baseUrl}/doctors/patients/${patientId}/consultation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                appointmentId: createdAppointmentId,
                diagnosis: "Mild hypertension",
                notes: "Patient reported occasional dizziness",
                treatmentPlan: "Monitor BP twice daily and adjust diet",
                prescriptions: [
                    {
                        medication: "Amlodipine",
                        dosage: "5mg",
                        frequency: "Once daily",
                        duration: "30 days",
                        instructions: "Take in the morning with water",
                    },
                ],
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.diagnosis).toBe("Mild hypertension");
        expect(data.prescriptions).toHaveLength(1);
        expect(data.prescriptions[0].medication).toBe("Amlodipine");

        createdConsultationId = data.id;
    });

    it("PATCH /doctors/consultations/:consultationId - doctor updates consultation notes", async () => {
        const res = await fetch(`${baseUrl}/doctors/consultations/${createdConsultationId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                notes: "Patient reported occasional dizziness, feels better today",
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.notes).toContain("feels better today");
    });

    it("GET /patients/me/consultations - patient retrieves consultations with prescriptions", async () => {
        const res = await fetch(`${baseUrl}/patients/me/consultations`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.consultations.length).toBeGreaterThan(0);
        const consult = data.consultations.find((c: any) => c.id === createdConsultationId);
        expect(consult).toBeDefined();
        expect(consult.prescriptions.length).toBe(1);
        expect(consult.prescriptions[0].medication).toBe("Amlodipine");
    });

    it("GET /patients/me/prescriptions - patient retrieves all active prescriptions", async () => {
        const res = await fetch(`${baseUrl}/patients/me/prescriptions`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.prescriptions.length).toBeGreaterThan(0);
        expect(data.prescriptions.some((p: any) => p.medication === "Amlodipine")).toBe(true);
    });
});

describe("Doctor Orders & Patient Reports Flow", () => {
    it("POST /doctors/patients/:patientId/orders - doctor orders lab test", async () => {
        const res = await fetch(`${baseUrl}/doctors/patients/${patientId}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                testName: "Lipid Profile & ECG",
                instructions: "Fasting for 12 hours required",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.test_name).toBe("Lipid Profile & ECG");
        expect(data.status).toBe("PENDING");
    });

    it("GET /patients/me/reports - patient views their ordered reports", async () => {
        const res = await fetch(`${baseUrl}/patients/me/reports`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reports.some((r: any) => r.test_name === "Lipid Profile & ECG")).toBe(true);
    });

    it("GET /doctors/patients/:patientId/reports - doctor views patient reports", async () => {
        const res = await fetch(`${baseUrl}/doctors/patients/${patientId}/reports`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reports.some((r: any) => r.test_name === "Lipid Profile & ECG")).toBe(true);
    });
});

describe("Patient Journey Timeline", () => {
    it("GET /patients/me/journey - synthesizes chronological patient timeline", async () => {
        const res = await fetch(`${baseUrl}/patients/me/journey`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.journey)).toBe(true);
        const types = data.journey.map((item: any) => item.type);
        expect(types).toContain("REGISTRATION");
        expect(types).toContain("APPOINTMENT");
        expect(types).toContain("CONSULTATION");
        expect(types).toContain("LAB_ORDER");
        expect(types).toContain("PRESCRIPTION");
    });
});

describe("Appointment Cancellation", () => {
    it("DELETE /patients/appointments/:id - patient cancels appointment", async () => {
        const res = await fetch(`${baseUrl}/patients/appointments/${createdAppointmentId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toContain("cancelled successfully");
    });
});

describe("Queue Lifecycle & Dynamic Prioritization", () => {
    it("POST /queue/join - should join queue as WALK_IN patient", async () => {
        const res = await fetch(`${baseUrl}/queue/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                patientId,
                doctorId,
                type: "WALK_IN",
                priority: 1,
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("id");
        expect(data.patient_id).toBe(patientId);
        expect(data.doctor_id).toBe(doctorId);
        expect(data.type).toBe("WALK_IN");
        expect(data.status).toBe("WAITING");
        expect(data).toHaveProperty("visit_id");
        expect(data.visit_id).toBeTruthy();

        walkInQueueEntryId = data.id;
    });

    it("POST /queue/join - should join queue as EMERGENCY patient with higher priority", async () => {
        const pRes = await fetch(`${baseUrl}/patients`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                name: "Emergency Patient",
                age: 45,
                gender: "Female",
                patientType: "Online",
            }),
        });
        expect(pRes.status).toBe(201);
        const pData = await pRes.json();
        secondPatientId = pData.id;

        const res = await fetch(`${baseUrl}/queue/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                patientId: secondPatientId,
                doctorId,
                type: "EMERGENCY",
                priority: 10,
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.type).toBe("EMERGENCY");
        expect(data.priority).toBe(10);
        expect(data.status).toBe("WAITING");
        expect(data).toHaveProperty("visit_id");
        expect(data.visit_id).toBeTruthy();

        emergencyQueueEntryId = data.id;
    });

    it("GET /queue - should sort entries by priority descending (Emergency before Walk-in)", async () => {
        const res = await fetch(`${baseUrl}/queue?doctorId=${doctorId}`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.queue)).toBe(true);
        expect(data.queue.length).toBeGreaterThanOrEqual(2);
        expect(data).toHaveProperty("waitingCount");
        expect(data.waitingCount).toBeGreaterThanOrEqual(2);
        // First entry should be emergency due to priority 10 vs 1
        expect(data.queue[0].id).toBe(emergencyQueueEntryId);
        expect(data.queue[0].type).toBe("EMERGENCY");
        expect(data.queue[0]).toHaveProperty("visit_id");
    });

    it("GET /patients/me/queue - patient should view active queue status", async () => {
        const res = await fetch(`${baseUrl}/patients/me/queue`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("queueEntry");
        expect(data.queueEntry).not.toBeNull();
        expect([walkInQueueEntryId, emergencyQueueEntryId]).toContain(data.queueEntry.id);
        expect(data.queueEntry).toHaveProperty("visit_id");
        expect(data).toHaveProperty("waitingCount");
    });

    it("GET /doctors/me/queue - doctor should view queue overview", async () => {
        const res = await fetch(`${baseUrl}/doctors/me/queue`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("queue");
        expect(Array.isArray(data.queue)).toBe(true);
        expect(data.queue.length).toBeGreaterThanOrEqual(2);
        expect(data).toHaveProperty("waitingCount");
        expect(data.queue[0]).toHaveProperty("visit_id");
    });

    it("POST /queue/doctor/call-next - doctor calls next highest-priority patient (CALLED)", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("next");
        expect(data.next.id).toBe(emergencyQueueEntryId);
        expect(data.next.status).toBe("CALLED");
        expect(data.next).toHaveProperty("called_at");
        expect(data.next.called_at).not.toBeNull();
    });

    it("POST /queue/:queueEntryId/start - doctor starts serving patient (IN_PROGRESS) and updates visit", async () => {
        const res = await fetch(`${baseUrl}/queue/${emergencyQueueEntryId}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(["IN_PROGRESS", "SERVING"]).toContain(data.status);
        expect(data.status).toBe("IN_PROGRESS");
        expect(data).toHaveProperty("started_at");
        expect(data.started_at).not.toBeNull();

        // Verify linked visit transitioned to IN_CONSULTATION
        const visitRes = await fetch(`${baseUrl}/visits/${data.visit_id}`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        expect(visitRes.status).toBe(200);
        const visitData = await visitRes.json();
        expect(visitData.status).toBe("IN_CONSULTATION");
    });

    it("POST /doctors/queue/:queueEntryId/complete - doctor completes consultation (COMPLETED)", async () => {
        const res = await fetch(`${baseUrl}/doctors/queue/${emergencyQueueEntryId}/complete`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("COMPLETED");
        expect(data).toHaveProperty("completed_at");
        expect(data.completed_at).not.toBeNull();

        // Linked visit should still be IN_CONSULTATION (complete does NOT auto-complete visit)
        const visitRes = await fetch(`${baseUrl}/visits/${data.visit_id}`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        expect(visitRes.status).toBe(200);
        const visitData = await visitRes.json();
        expect(visitData.status).toBe("IN_CONSULTATION");
    });

    it("POST /doctors/queue/:queueEntryId/skip - doctor skips walk-in patient (SKIPPED)", async () => {
        const res = await fetch(`${baseUrl}/doctors/queue/${walkInQueueEntryId}/skip`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("SKIPPED");
    });

    it("POST /queue/join - should accept an existing visitId and advance it to WAITING_OPD", async () => {
        // Create visit directly first
        const vRes = await fetch(`${baseUrl}/visits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                patientId,
                visitType: "WALK_IN",
                assignedDoctorId: doctorId,
            }),
        });
        expect(vRes.status).toBe(201);
        const createdVisit = await vRes.json();
        expect(createdVisit.status).toBe("REGISTERED");

        // Now join queue with this visitId
        const qRes = await fetch(`${baseUrl}/queue/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                visitId: createdVisit.id,
                doctorId,
                priority: 5,
            }),
        });
        expect(qRes.status).toBe(201);
        const qData = await qRes.json();
        expect(qData.visit_id).toBe(createdVisit.id);
        expect(qData.status).toBe("WAITING");

        // Verify that the visit has advanced to WAITING_OPD
        const checkV = await fetch(`${baseUrl}/visits/${createdVisit.id}`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(checkV.status).toBe(200);
        const checkData = await checkV.json();
        expect(checkData.status).toBe("WAITING_OPD");
    });
});

describe("Patient Creation & Profile Ownership Flow", () => {
    let familyPatientId: string;

    it("POST /patients - user creates a family member patient profile", async () => {
        const res = await fetch(`${baseUrl}/patients`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                name: "Tommy Connor",
                age: 8,
                gender: "Male",
                patientType: "Online",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.name).toBe("Tommy Connor");
        expect(data.owner_user_id).toBe(userId);
        familyPatientId = data.id;
    });

    it("GET /patients - owner lists all managed patient profiles", async () => {
        const res = await fetch(`${baseUrl}/patients`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.patients)).toBe(true);
        expect(data.patients.some((p: any) => p.id === familyPatientId)).toBe(true);
    });

    it("GET /patients/byId/:patientId - owner retrieves patient profile", async () => {
        const res = await fetch(`${baseUrl}/patients/byId/${familyPatientId}`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.id).toBe(familyPatientId);
        expect(data.name).toBe("Tommy Connor");
    });

    it("PATCH /patients/byId/:patientId - owner updates patient profile", async () => {
        const res = await fetch(`${baseUrl}/patients/byId/${familyPatientId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                age: 9,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.age).toBe(9);
    });

    it("GET /patients/byId/:patientId - other user cannot access patient profile (ownership enforcement)", async () => {
        const res = await fetch(`${baseUrl}/patients/byId/${familyPatientId}`, {
            headers: { Authorization: `Bearer ${otherUserToken}` },
        });

        expect(res.status).toBe(403);
    });

    it("PATCH /patients/byId/:patientId - other user cannot modify patient profile (ownership enforcement)", async () => {
        const res = await fetch(`${baseUrl}/patients/byId/${familyPatientId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${otherUserToken}`,
            },
            body: JSON.stringify({
                name: "Hacked Name",
            }),
        });

        expect(res.status).toBe(403);
    });
});

describe("Staff Administration & Role Enforcement Flow", () => {
    it("POST /admin/staff - admin creates staff member (NURSE)", async () => {

        const res = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Nurse Florence",
                email: nurseEmail,
                password: nursePassword,
                employeeCode: `NURSE-${Date.now().toString().slice(-6)}`,
                role: "NURSE",
                status: "ACTIVE",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("staff");
        expect(data.staff.role).toBe("NURSE");
        expect(data).toHaveProperty("user");
        expect(data).toHaveProperty("temporaryPassword");
        expect(data.temporaryPassword).toBe(nursePassword);

        createdStaffId = data.staff.id;
        createdStaffUserId = data.user.id;

        nurseToken = jwt.sign(
            { userId: createdStaffUserId, email: nurseEmail, role: "STAFF", staffRole: "NURSE" },
            jwtSecret!,
            { expiresIn: "4h" }
        );
    });

    it("GET /staff/me - staff member retrieves own staff profile", async () => {
        const res = await fetch(`${baseUrl}/staff/me`, {
            headers: { Authorization: `Bearer ${nurseToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.staff_role).toBe("NURSE");
        expect(data.email).toBe(nurseEmail);
    });

    it("GET /doctors/me - non-doctor staff cannot access clinical doctor routes", async () => {
        const res = await fetch(`${baseUrl}/doctors/me`, {
            headers: { Authorization: `Bearer ${nurseToken}` },
        });

        expect(res.status).toBe(403);
    });

    it("GET /admin/staff - non-admin staff cannot access admin routes", async () => {
        const res = await fetch(`${baseUrl}/admin/staff`, {
            headers: { Authorization: `Bearer ${nurseToken}` },
        });

        expect(res.status).toBe(403);
    });

    it("POST /staff/login - staff member can authenticate through staff login", async () => {
        const res = await fetch(`${baseUrl}/staff/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: nurseEmail,
                password: nursePassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.user.role).toBe("STAFF");
        expect(data.user.staffRole).toBe("NURSE");
    });

    it("POST /staff/login - rejects patient accounts attempting staff portal login", async () => {
        const res = await fetch(`${baseUrl}/staff/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: patientEmail,
                password: patientPassword,
            }),
        });

        expect(res.status).toBe(403);
    });

    it("POST /staff/login - doctor authenticates and receives doctor profile details", async () => {
        const res = await fetch(`${baseUrl}/staff/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: doctorEmail,
                password: doctorPassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.user.staffRole).toBe("DOCTOR");
        expect(data).toHaveProperty("doctor");
    });

    it("POST /admin/staff - creates staff without password, returns generated temporaryPassword, and logs in via POST /auth/login", async () => {
        const res = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Alex Lab Technician",
                email: autoPassStaffEmail,
                role: "LAB_TECH",
                status: "ACTIVE",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("staff");
        expect(data.staff.role).toBe("LAB_TECH");
        expect(data).toHaveProperty("user");
        expect(data.user.email).toBe(autoPassStaffEmail.toLowerCase());
        expect(data).toHaveProperty("temporaryPassword");
        expect(typeof data.temporaryPassword).toBe("string");
        expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(6);

        autoPassStaffId = data.staff.id;
        autoPassStaffUserId = data.user.id;
        autoPassTemporaryPassword = data.temporaryPassword;

        // Verify newly created staff can log in using POST /auth/login with temporaryPassword
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: autoPassStaffEmail,
                password: autoPassTemporaryPassword,
            }),
        });

        expect(loginRes.status).toBe(200);
        const loginData = await loginRes.json();
        expect(loginData).toHaveProperty("token");
        expect(loginData.user.role).toBe("STAFF");
        expect(loginData.user.staffRole).toBe("LAB_TECH");

        const decoded = jwt.decode(loginData.token) as Record<string, unknown>;
        expect(decoded["userId"]).toBe(autoPassStaffUserId);
        expect(decoded["role"]).toBe("STAFF");
        expect(decoded["staffRole"]).toBe("LAB_TECH");
    });

    it("PATCH /admin/staff/:staffId/status - deactivating staff updates staff_profiles and sets users.is_active = false, blocking login", async () => {
        const patchRes = await fetch(`${baseUrl}/admin/staff/${autoPassStaffId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                status: "INACTIVE",
            }),
        });

        expect(patchRes.status).toBe(200);
        const patchData = await patchRes.json();
        expect(patchData.status).toBe("INACTIVE");

        // Verify users.is_active is now false in DB
        const userCheck = await pool.query<{ is_active: boolean }>(
            'SELECT is_active FROM "users" WHERE id = $1',
            [autoPassStaffUserId]
        );
        expect(userCheck.rows[0]?.is_active).toBe(false);

        // Attempt login via POST /auth/login - should fail with 403 Forbidden
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: autoPassStaffEmail,
                password: autoPassTemporaryPassword,
            }),
        });

        expect(loginRes.status).toBe(403);
    });

    it("PATCH /admin/staff/:staffId/status - reactivating staff sets users.is_active = true and restores login", async () => {
        const patchRes = await fetch(`${baseUrl}/admin/staff/${autoPassStaffId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                status: "ACTIVE",
            }),
        });

        expect(patchRes.status).toBe(200);
        const patchData = await patchRes.json();
        expect(patchData.status).toBe("ACTIVE");

        // Verify users.is_active is now true in DB
        const userCheck = await pool.query<{ is_active: boolean }>(
            'SELECT is_active FROM "users" WHERE id = $1',
            [autoPassStaffUserId]
        );
        expect(userCheck.rows[0]?.is_active).toBe(true);

        // Login via POST /auth/login should succeed again
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: autoPassStaffEmail,
                password: autoPassTemporaryPassword,
            }),
        });

        expect(loginRes.status).toBe(200);
    });

    it("POST /admin/staff - admin creates staff with role=DOCTOR in single transaction creating user, staff, and doctor", async () => {
        const res = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Dr. Gregory House AdminCreated",
                email: adminCreatedDocStaffEmail,
                role: "DOCTOR",
                specialization: "Pediatrics",
                department: "Pediatrics Department",
                licenseNumber: `LIC-STAFF-DOC-${Date.now()}`,
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("staff");
        expect(data.staff.role).toBe("DOCTOR");
        expect(data).toHaveProperty("user");
        expect(data).toHaveProperty("doctor");
        expect(data.doctor.specialization).toBe("Pediatrics");
        expect(data.doctor.department).toBe("Pediatrics Department");
        expect(data).toHaveProperty("temporaryPassword");

        adminCreatedDocStaffId = data.staff.id;
        adminCreatedDocStaffUserId = data.user.id;

        // Verify login via POST /auth/login returns staffRole=DOCTOR
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: adminCreatedDocStaffEmail,
                password: data.temporaryPassword,
            }),
        });

        expect(loginRes.status).toBe(200);
        const loginData = await loginRes.json();
        expect(loginData.user.role).toBe("STAFF");
        expect(loginData.user.staffRole).toBe("DOCTOR");
        expect(loginData).toHaveProperty("doctor");
    });

    it("PATCH /admin/staff/:staffId - updates name and email in users table, reflected in GET /admin/staff", async () => {
        const updatedName = "Alex Tech Updated";
        const patchRes = await fetch(`${baseUrl}/admin/staff/${autoPassStaffId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: updatedName,
            }),
        });

        expect(patchRes.status).toBe(200);

        // GET /admin/staff joins through to users for name and email
        const listRes = await fetch(`${baseUrl}/admin/staff`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(listRes.status).toBe(200);
        const listData = await listRes.json();
        const found = listData.staff.find((s: { id: string }) => s.id === autoPassStaffId);
        expect(found).toBeDefined();
        expect(found.name).toBe(updatedName);
        expect(found.email).toBe(autoPassStaffEmail.toLowerCase());
    });

    it("GET /admin/doctors - joins through to users for name and email", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.doctors)).toBe(true);
        const found = data.doctors.find((d: { email: string }) => d.email.toLowerCase() === adminCreatedDocStaffEmail.toLowerCase());
        expect(found).toBeDefined();
        expect(found.name).toBe("Dr. Gregory House AdminCreated");
    });
});

describe("Doctor Creation via Admin & Department Hierarchy", () => {
    let newDoctorToken: string;

    it("POST /admin/doctors - admin creates doctor with department", async () => {

        const res = await fetch(`${baseUrl}/admin/doctors`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Dr. Gregory House",
                email: newDocEmail,
                password: newDocPassword,
                specialization: "Neurology",
                department: "Neurology Department",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.name).toBe("Dr. Gregory House");
        expect(data.specialization).toBe("Neurology");
        expect(data.department).toBe("Neurology Department");

        createdAdminDoctorId = data.id;

        // Find user ID for cleanup
        const u = await pool.query<{ user_id: string }>(
            'SELECT s.user_id FROM "staff_profiles" s JOIN "doctors" d ON d.staff_id = s.id WHERE d.id = $1',
            [createdAdminDoctorId]
        );
        if (u.rows[0]) {
            createdAdminDoctorUserId = u.rows[0].user_id;
        }
    });

    it("POST /doctors/login - newly created doctor can log in", async () => {
        const res = await fetch(`${baseUrl}/doctors/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: newDocEmail,
                password: newDocPassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        newDoctorToken = data.token;
    });

    it("GET /doctors/me - new doctor accesses profile with department resolution", async () => {
        const res = await fetch(`${baseUrl}/doctors/me`, {
            headers: { Authorization: `Bearer ${newDoctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.id).toBe(createdAdminDoctorId);
        expect(data.specialization).toBe("Neurology");
        expect(data.department).toBe("Neurology Department");
    });
});

describe("Comprehensive Role-Based Authorization Enforcement", () => {
    it("Patient token cannot access doctor-only routes (GET /doctors/me)", async () => {
        const res = await fetch(`${baseUrl}/doctors/me`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(res.status).toBe(403);
    });

    it("Patient token cannot access admin-only routes (GET /admin/doctors)", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(res.status).toBe(403);
    });

    it("Doctor token cannot access patient-only profile route (GET /patients/me)", async () => {
        const res = await fetch(`${baseUrl}/patients/me`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        expect(res.status).toBe(403);
    });

    it("Doctor token cannot access admin-only staff routes (POST /admin/staff)", async () => {
        const res = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                name: "Intruder Staff",
                email: "intruder@example.com",
                password: "Password123!",
                employeeCode: "INT-001",
                role: "RECEPTIONIST",
            }),
        });
        expect(res.status).toBe(403);
    });

    it("Unauthenticated request cannot access protected route (GET /staff/me)", async () => {
        const res = await fetch(`${baseUrl}/staff/me`);
        expect(res.status).toBe(401);
    });
});

describe("Unified Auth System (POST /auth/login & POST /auth/register)", () => {
    it("POST /auth/login - patient logs in successfully with correct JWT payload shape", async () => {
        const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: patientEmail,
                password: patientPassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.user.role).toBe("PATIENT");

        const decoded = jwt.decode(data.token) as Record<string, unknown>;
        expect(decoded["userId"]).toBe(userId);
        expect(decoded["email"]).toBe(patientEmail);
        expect(decoded["role"]).toBe("PATIENT");
        expect(decoded["staffRole"]).toBeUndefined();
    });

    it("POST /auth/login - staff member (nurse) logs in successfully", async () => {
        const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: nurseEmail,
                password: nursePassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.user.role).toBe("STAFF");
        expect(data.user.staffRole).toBe("NURSE");
    });

    it("JWT payload shape for a staff user - includes userId, email, role, and staffRole", async () => {
        const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: nurseEmail,
                password: nursePassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        const decoded = jwt.decode(data.token) as Record<string, unknown>;

        expect(decoded).toHaveProperty("userId");
        expect(typeof decoded["userId"]).toBe("string");
        expect(decoded["userId"]).toBe(createdStaffUserId);
        expect(decoded).toHaveProperty("email", nurseEmail);
        expect(decoded).toHaveProperty("role", "STAFF");
        expect(decoded).toHaveProperty("staffRole", "NURSE");
    });

    it("POST /auth/login - doctor logs in through unified endpoint with staffRole=DOCTOR", async () => {
        const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: newDocEmail,
                password: newDocPassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.user.role).toBe("STAFF");
        expect(data.user.staffRole).toBe("DOCTOR");

        const decoded = jwt.decode(data.token) as Record<string, unknown>;
        expect(decoded["role"]).toBe("STAFF");
        expect(decoded["staffRole"]).toBe("DOCTOR");
    });

    it("POST /auth/login - admin logs in through unified endpoint with staffRole omitted", async () => {
        const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: adminEmail,
                password: adminPassword,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.user.role).toBe("ADMIN");

        const decoded = jwt.decode(data.token) as Record<string, unknown>;
        expect(decoded["role"]).toBe("ADMIN");
        expect(decoded["staffRole"]).toBeUndefined();
    });

    it("POST /auth/register - rejects attempt to register with role=STAFF", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Attacker Staff",
                email: `attacker_staff_${Date.now()}@example.com`,
                password: "password123",
                role: "STAFF",
            }),
        });

        expect([400, 403]).toContain(res.status);
    });

    it("POST /auth/register - rejects attempt to register with role=ADMIN", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Attacker Admin",
                email: `attacker_admin_${Date.now()}@example.com`,
                password: "password123",
                role: "ADMIN",
            }),
        });

        expect([400, 403]).toContain(res.status);
    });

    it("POST /auth/register - patient registration succeeds", async () => {
        regPatientEmail = `valid_patient_${Date.now()}@example.com`;
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "New Valid Patient",
                email: regPatientEmail,
                password: "password123",
                role: "PATIENT",
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("token");
        expect(data.user.role).toBe("PATIENT");

        const decoded = jwt.decode(data.token) as Record<string, unknown>;
        expect(decoded["role"]).toBe("PATIENT");
        expect(decoded["staffRole"]).toBeUndefined();
    });
});

describe("Visits Backbone Module & Status Transition Matrix Flow", () => {
    let testVisitId: string;
    let onlineVisitId: string;

    it("POST /visits - staff creates visit with status=REGISTERED", async () => {
        const res = await fetch(`${baseUrl}/visits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nurseToken}`,
            },
            body: JSON.stringify({
                patient_id: patientId,
                visit_type: "OPD",
                assigned_doctor_id: doctorId,
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("id");
        expect(data.patient_id).toBe(patientId);
        expect(["OPD", "WALKIN"]).toContain(data.visit_type);
        expect(data.status).toBe("REGISTERED");
        expect([createdStaffUserId, createdStaffId]).toContain(data.registered_by);

        testVisitId = data.id;
    });

    it("POST /visits - patient creates visit for own profile (online check-in)", async () => {
        const res = await fetch(`${baseUrl}/visits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                patientId,
                visitType: "ONLINE",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("id");
        expect(data.patientId).toBe(patientId);
        expect(data.visitType).toBe("ONLINE");
        expect(data.status).toBe("REGISTERED");
        expect(data.registeredBy).toBe(userId);

        onlineVisitId = data.id;
    });

    it("POST /visits - patient cannot create visit for another user's patient profile (403)", async () => {
        const res = await fetch(`${baseUrl}/visits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${otherUserToken}`,
            },
            body: JSON.stringify({
                patient_id: patientId,
                visit_type: "ONLINE",
            }),
        });

        expect(res.status).toBe(403);
    });

    it("POST /visits - unauthenticated request is rejected (401)", async () => {
        const res = await fetch(`${baseUrl}/visits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patient_id: patientId,
                visit_type: "ONLINE",
            }),
        });

        expect(res.status).toBe(401);
    });

    it("GET /patients/me/current-visit - retrieves authenticated patient's active visit", async () => {
        const res = await fetch(`${baseUrl}/patients/me/current-visit`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).not.toBeNull();
        expect(data.id).toBe(onlineVisitId);
        expect(data.status).toBe("REGISTERED");
    });

    it("GET /visits/:id - returns full visit detail with joined related entities", async () => {
        // Seed test vitals and invoice linked to testVisitId
        await pool.query(
            `INSERT INTO "vitals" (visit_id, recorded_by, temperature_c, pulse_bpm, blood_pressure)
             VALUES ($1, (SELECT id FROM "staff_profiles" WHERE user_id = $2 OR id = $2 LIMIT 1), 98.6, 72, '120/80')`,
            [testVisitId, createdStaffUserId]
        );
        await pool.query(
            `INSERT INTO "invoices" (visit_id, patient_id, total_amount, status)
             VALUES ($1, $2, 250.00, 'PENDING')`,
            [testVisitId, patientId]
        );

        const res = await fetch(`${baseUrl}/visits/${testVisitId}`, {
            headers: { Authorization: `Bearer ${nurseToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.id).toBe(testVisitId);
        expect(data).toHaveProperty("vitals");
        expect(Array.isArray(data.vitals)).toBe(true);
        expect(data.vitals.length).toBeGreaterThanOrEqual(1);
        expect(data.vitals[0].temperature).toBe("98.6");

        expect(data).toHaveProperty("invoices");
        expect(Array.isArray(data.invoices)).toBe(true);
        expect(data.invoices.length).toBeGreaterThanOrEqual(1);

        expect(data).toHaveProperty("queue_entries");
        expect(data).toHaveProperty("consultations");
        expect(data).toHaveProperty("prescriptions");
        expect(data).toHaveProperty("investigation_orders");
    });

    it("GET /visits/:id - other user cannot access patient's visit (403)", async () => {
        const res = await fetch(`${baseUrl}/visits/${testVisitId}`, {
            headers: { Authorization: `Bearer ${otherUserToken}` },
        });

        expect(res.status).toBe(403);
    });

    describe("Visit Status Transition Matrix: Legal Forward Moves", () => {
        let visitSeqId: string;

        it("Step 1: create visit in REGISTERED", async () => {
            const res = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({
                    patient_id: patientId,
                    visit_type: "OPD",
                }),
            });
            expect(res.status).toBe(201);
            const data = await res.json();
            visitSeqId = data.id;
            expect(data.status).toBe("REGISTERED");
        });

        it("REGISTERED -> VITALS (legal)", async () => {
            const res = await fetch(`${baseUrl}/visits/${visitSeqId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({ status: "VITALS" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("VITALS");
        });

        it("VITALS -> WAITING_OPD (legal)", async () => {
            const res = await fetch(`${baseUrl}/visits/${visitSeqId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("WAITING_OPD");
        });

        it("WAITING_OPD -> IN_CONSULTATION (legal)", async () => {
            const res = await fetch(`${baseUrl}/visits/${visitSeqId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({ status: "IN_CONSULTATION" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("IN_CONSULTATION");
        });

        it("IN_CONSULTATION -> DIAGNOSTICS (legal)", async () => {
            const res = await fetch(`${baseUrl}/visits/${visitSeqId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({ status: "DIAGNOSTICS" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("DIAGNOSTICS");
        });

        it("DIAGNOSTICS -> PHARMACY (legal)", async () => {
            const res = await fetch(`${baseUrl}/visits/${visitSeqId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({ status: "PHARMACY" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("PHARMACY");
        });

        it("PHARMACY -> BILLING (legal)", async () => {
            const res = await fetch(`${baseUrl}/visits/${visitSeqId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("BILLING");
        });

        it("BILLING -> COMPLETED (legal terminal)", async () => {
            const res = await fetch(`${baseUrl}/visits/${visitSeqId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({ status: "COMPLETED" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("COMPLETED");
        });
    });

    describe("Visit Status Transition Matrix: Legal Skips", () => {
        it("IN_CONSULTATION -> PHARMACY (skipping DIAGNOSTICS)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "IN_CONSULTATION" }),
            });

            // Skip DIAGNOSTICS directly to PHARMACY
            const res = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "PHARMACY" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("PHARMACY");
        });

        it("IN_CONSULTATION -> BILLING (skipping both DIAGNOSTICS and PHARMACY)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "IN_CONSULTATION" }),
            });

            // Skip DIAGNOSTICS and PHARMACY directly to BILLING
            const res = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("BILLING");
        });

        it("WAITING_OPD -> BILLING (skipping consultation, diagnostics, pharmacy)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });

            // Move directly from WAITING_OPD to BILLING
            const res = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("BILLING");
        });

        it("DIAGNOSTICS -> BILLING (skipping PHARMACY)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "IN_CONSULTATION" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "DIAGNOSTICS" }),
            });

            // Skip PHARMACY to BILLING
            const res = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("BILLING");
        });
    });

    describe("Visit Status Transition Matrix: Cancellation from Non-Completed States", () => {
        it("REGISTERED -> CANCELLED (legal)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            const res = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "CANCELLED" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("CANCELLED");
        });

        it("VITALS -> CANCELLED (legal)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });

            const res = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "CANCELLED" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("CANCELLED");
        });

        it("BILLING -> CANCELLED (legal from any non-completed state)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });

            const res = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "CANCELLED" }),
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.status).toBe("CANCELLED");
        });
    });

    describe("Visit Status Transition Matrix: Illegal & Backward Transitions Rejected (400)", () => {
        let testIllegalVisitId: string;

        beforeAll(async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const data = await createRes.json();
            testIllegalVisitId = data.id;
        });

        it("REGISTERED -> BILLING (illegal forward skip) rejected with 400", async () => {
            const res = await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(res.status).toBe(400);
        });

        it("REGISTERED -> COMPLETED (illegal forward skip) rejected with 400", async () => {
            const res = await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "COMPLETED" }),
            });
            expect(res.status).toBe(400);
        });

        it("REGISTERED -> REGISTERED (no-op) rejected with 400", async () => {
            const res = await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "REGISTERED" }),
            });
            expect(res.status).toBe(400);
        });

        it("Backward transition: VITALS -> REGISTERED rejected with 400", async () => {
            // Move to VITALS first
            await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });

            // Attempt backward move to REGISTERED
            const res = await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "REGISTERED" }),
            });
            expect(res.status).toBe(400);
        });

        it("COMPLETED -> CANCELLED rejected with 400", async () => {
            // Advance to COMPLETED
            await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });
            await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "COMPLETED" }),
            });

            // Attempt to CANCEL completed visit
            const res = await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "CANCELLED" }),
            });
            expect(res.status).toBe(400);
        });

        it("COMPLETED -> BILLING rejected with 400", async () => {
            const res = await fetch(`${baseUrl}/visits/${testIllegalVisitId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(res.status).toBe(400);
        });

        it("CANCELLED visit cannot transition to any other status (rejected with 400)", async () => {
            const createRes = await fetch(`${baseUrl}/visits`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ patient_id: patientId, visit_type: "OPD" }),
            });
            const { id } = await createRes.json();

            // Cancel it
            await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "CANCELLED" }),
            });

            // Try to move to REGISTERED or COMPLETED
            const res1 = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "REGISTERED" }),
            });
            expect(res1.status).toBe(400);

            const res2 = await fetch(`${baseUrl}/visits/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${nurseToken}` },
                body: JSON.stringify({ status: "COMPLETED" }),
            });
            expect(res2.status).toBe(400);
        });
    });

    it("GET /patients/me/current-visit - returns null when active visit is cancelled/completed", async () => {
        // Complete all active visits for this user's patients
        await pool.query(
            `UPDATE "visits" SET status = 'COMPLETED' WHERE patient_id IN (SELECT id FROM "patient_profiles" WHERE owner_user_id = $1)`,
            [userId]
        );

        const res = await fetch(`${baseUrl}/patients/me/current-visit`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toBeNull();
    });
});

describe("Clinical Modules & Full Visit Lifecycle (Vitals -> Consultation -> Lab -> Pharmacy -> Billing -> Completed)", () => {
    let clinicalVisitId: string;
    let clinicalPrescriptionId: string;
    let clinicalOrderId: string;
    let clinicalInvoiceId: string;
    let pharmacistToken: string;
    let labTechToken: string;

    beforeAll(() => {
        const staffUser = createdStaffUserId || userId;
        pharmacistToken = jwt.sign(
            { userId: staffUser, email: "pharmacist@hospital.test", role: "STAFF", staffRole: "PHARMACIST" },
            jwtSecret!,
            { expiresIn: "4h" }
        );
        labTechToken = jwt.sign(
            { userId: staffUser, email: "labtech@hospital.test", role: "STAFF", staffRole: "LAB_TECH" },
            jwtSecret!,
            { expiresIn: "4h" }
        );
    });

    it("POST /visits - creates visit in REGISTERED status", async () => {
        const res = await fetch(`${baseUrl}/visits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                patientId,
                visitType: "OPD",
                assignedDoctorId: doctorId,
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.status).toBe("REGISTERED");
        expect(data.patient_id).toBe(patientId);
        clinicalVisitId = data.id;
    });

    it("POST /visits/:visitId/vitals - records vitals and transitions visit to VITALS", async () => {
        const res = await fetch(`${baseUrl}/visits/${clinicalVisitId}/vitals`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nurseToken}`,
            },
            body: JSON.stringify({
                temperature: 98.6,
                heartRate: 72,
                bloodPressure: "120/80",
                respiratoryRate: 16,
                oxygenSaturation: 99,
                weight: 70.5,
                height: 175,
                notes: "Vitals normal",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toHaveProperty("id");
        expect(data.visit_id).toBe(clinicalVisitId);
        expect(Number(data.temperature)).toBe(98.6);
        expect(data.heart_rate).toBe(72);
        expect(data.blood_pressure).toBe("120/80");

        // Verify visit status transitioned to VITALS
        const vRes = await fetch(`${baseUrl}/visits/${clinicalVisitId}`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(vRes.status).toBe(200);
        const vData = await vRes.json();
        expect(vData.status).toBe("VITALS");
    });

    it("GET /visits/:visitId/vitals - retrieves vitals for visit", async () => {
        const res = await fetch(`${baseUrl}/visits/${clinicalVisitId}/vitals`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("vitals");
        expect(data.vitals.length).toBeGreaterThan(0);
        expect(data.vitals[0].visit_id).toBe(clinicalVisitId);
    });

    it("POST /queue/join & POST /queue/:id/start - moves visit to WAITING_OPD then IN_CONSULTATION", async () => {
        const joinRes = await fetch(`${baseUrl}/queue/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${patientToken}`,
            },
            body: JSON.stringify({
                visitId: clinicalVisitId,
                doctorId,
                priority: 1,
            }),
        });
        expect(joinRes.status).toBe(201);
        const joinData = await joinRes.json();
        expect(joinData.visit_id).toBe(clinicalVisitId);

        const vRes1 = await fetch(`${baseUrl}/visits/${clinicalVisitId}`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        const vData1 = await vRes1.json();
        expect(vData1.status).toBe("WAITING_OPD");

        // Start consultation in queue
        const startRes = await fetch(`${baseUrl}/queue/${joinData.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        expect(startRes.status).toBe(200);

        const vRes2 = await fetch(`${baseUrl}/visits/${clinicalVisitId}`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        const vData2 = await vRes2.json();
        expect(vData2.status).toBe("IN_CONSULTATION");
    });

    it("POST /doctors/patients/:patientId/consultation - creates consultation and pending prescription", async () => {
        const res = await fetch(`${baseUrl}/doctors/patients/${patientId}/consultation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                visitId: clinicalVisitId,
                diagnosis: "Acute Bronchitis",
                notes: "Persistent cough and mild fever",
                treatmentPlan: "Antibiotics and rest",
                prescriptions: [
                    {
                        medication: "Amoxicillin",
                        dosage: "500mg",
                        frequency: "TDS",
                        duration: "7 days",
                        instructions: "After meals",
                    },
                ],
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.visit_id).toBe(clinicalVisitId);
        expect(data.prescriptions).toHaveLength(1);
        expect(data.prescriptions[0].status).toBe("PENDING");
        expect(data.prescriptions[0].visit_id).toBe(clinicalVisitId);
        clinicalPrescriptionId = data.prescriptions[0].id;
    });

    it("POST /lab-orders - creates investigation order attached to visit", async () => {
        const res = await fetch(`${baseUrl}/lab-orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nurseToken}`,
            },
            body: JSON.stringify({
                patientId,
                visitId: clinicalVisitId,
                testName: "Chest X-Ray",
                instructions: "PA view",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.visit_id).toBe(clinicalVisitId);
        expect(data.test_name).toBe("Chest X-Ray");
        expect(data.status).toBe("PENDING");
        clinicalOrderId = data.id;
    });

    it("PATCH /lab-orders/:id - lab technician updates status and test result", async () => {
        const res = await fetch(`${baseUrl}/lab-orders/${clinicalOrderId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${labTechToken}`,
            },
            body: JSON.stringify({
                status: "COMPLETED",
                result: "Clear lung fields, no consolidation",
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("COMPLETED");
        expect(data.result).toBe("Clear lung fields, no consolidation");
    });

    it("PATCH /prescriptions/:id/dispense - pharmacist dispenses medication and creates dispense record", async () => {
        const res = await fetch(`${baseUrl}/prescriptions/${clinicalPrescriptionId}/dispense`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${pharmacistToken}`,
            },
            body: JSON.stringify({
                quantity: 21,
                notes: "Dispensed 21 capsules",
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("prescription");
        expect(data).toHaveProperty("dispense");
        expect(data.prescription.status).toBe("DISPENSED");
        expect(data.dispense.dispensed_quantity).toBe(21);
        expect(data.dispense.notes).toBe("Dispensed 21 capsules");

        // Verify GET /prescriptions/:id returns dispenses
        const checkRes = await fetch(`${baseUrl}/prescriptions/${clinicalPrescriptionId}`, {
            headers: { Authorization: `Bearer ${pharmacistToken}` },
        });
        expect(checkRes.status).toBe(200);
        const checkData = await checkRes.json();
        expect(checkData.status).toBe("DISPENSED");
        expect(checkData.dispenses).toHaveLength(1);
    });

    it("POST /visits/:visitId/invoice - generates invoice with derived line items and moves visit to BILLING", async () => {
        const res = await fetch(`${baseUrl}/visits/${clinicalVisitId}/invoice`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nurseToken}`,
            },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.visit_id).toBe(clinicalVisitId);
        expect(data.status).toBe("PENDING");
        expect(Number(data.amount)).toBeGreaterThan(0);
        expect(Array.isArray(data.invoice_items)).toBe(true);
        expect(data.invoice_items.length).toBeGreaterThanOrEqual(3);

        const itemTypes = data.invoice_items.map((i: any) => i.item_type);
        expect(itemTypes).toContain("CONSULTATION");
        expect(itemTypes).toContain("INVESTIGATION");
        expect(itemTypes).toContain("MEDICATION");

        clinicalInvoiceId = data.id;

        // Verify visit transitioned to BILLING
        const vRes = await fetch(`${baseUrl}/visits/${clinicalVisitId}`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(vRes.status).toBe(200);
        const vData = await vRes.json();
        expect(vData.status).toBe("BILLING");
    });

    it("PATCH /invoices/:id/pay - marks invoice PAID and completes the visit", async () => {
        const res = await fetch(`${baseUrl}/invoices/${clinicalInvoiceId}/pay`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nurseToken}`,
            },
            body: JSON.stringify({
                paymentMethod: "UPI",
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.invoice.status).toBe("PAID");

        // Verify visit transitioned to COMPLETED
        const vRes = await fetch(`${baseUrl}/visits/${clinicalVisitId}`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });
        expect(vRes.status).toBe(200);
        const vData = await vRes.json();
        expect(vData.status).toBe("COMPLETED");

        // Verify all joined fields are present in visit detail
        expect(vData.vitals).toHaveLength(1);
        expect(vData.queueEntries.length).toBeGreaterThan(0);
        expect(vData.consultations).toHaveLength(1);
        expect(vData.prescriptions).toHaveLength(1);
        expect(vData.investigationOrders).toHaveLength(1);
        expect(vData.invoices).toHaveLength(1);
    });
});



