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

let createdAdminDoctorId: string;
let createdAdminDoctorUserId: string;

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

    // Seed a Doctor
    const hashedPassword = await bcrypt.hash(doctorPassword, 10);
    const docRes = await pool.query(
        `INSERT INTO "Doctor" (name, email, password, specialization, department)
         VALUES ($1, $2, $3, 'Cardiology', 'Cardiology Department')
         RETURNING id, name, email`,
        ["Dr. Sarah Connor", doctorEmail, hashedPassword]
    );
    doctorId = docRes.rows[0].id;

    // Seed a User
    const hashedPatientPassword = await bcrypt.hash(patientPassword, 10);
    const userRes = await pool.query(
        `INSERT INTO "User" (name, email, password, role)
         VALUES ($1, $2, $3, 'USER')
         RETURNING id, name, email`,
        ["John Connor", patientEmail, hashedPatientPassword]
    );
    userId = userRes.rows[0].id;

    // Seed a Patient record
    const patRes = await pool.query(
        `INSERT INTO "Patient" (owner_user_id, name, age, gender, patient_type, doctor_id)
         VALUES ($1, 'John Connor', 35, 'Male', 'Online', $2)
         RETURNING id`,
        [userId, doctorId]
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
        `INSERT INTO "Admin" (name, email, password)
         VALUES ($1, $2, $3)
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
        `INSERT INTO "User" (name, email, password, role)
         VALUES ($1, $2, $3, 'USER')
         RETURNING id, name, email`,
        ["Jane Smith", otherUserEmail, patientPassword]
    );
    otherUserId = otherUserRes.rows[0].id;
    otherUserToken = jwt.sign(
        { userId: otherUserId, email: otherUserEmail, role: "USER" },
        jwtSecret,
        { expiresIn: "4h" }
    );
});

afterAll(async () => {
    // Cleanup any created queue entries
    if (doctorId) {
        await pool.query('DELETE FROM "QueueEntry" WHERE doctor_id = $1', [doctorId]);
    }
    if (createdAdminDoctorId) {
        await pool.query('DELETE FROM "QueueEntry" WHERE doctor_id = $1', [createdAdminDoctorId]);
        await pool.query('DELETE FROM "Doctor" WHERE id = $1', [createdAdminDoctorId]);
    }
    if (createdAdminDoctorUserId) {
        await pool.query('DELETE FROM "Staff" WHERE user_id = $1', [createdAdminDoctorUserId]);
        await pool.query('DELETE FROM "User" WHERE id = $1', [createdAdminDoctorUserId]);
    }
    if (createdStaffUserId) {
        await pool.query('DELETE FROM "Staff" WHERE user_id = $1', [createdStaffUserId]);
        await pool.query('DELETE FROM "User" WHERE id = $1', [createdStaffUserId]);
    }
    if (secondPatientId) {
        await pool.query('DELETE FROM "QueueEntry" WHERE patient_id = $1', [secondPatientId]);
        await pool.query('DELETE FROM "Patient" WHERE id = $1', [secondPatientId]);
    }
    if (patientId) {
        await pool.query('DELETE FROM "QueueEntry" WHERE patient_id = $1', [patientId]);
        await pool.query('DELETE FROM "Prescription" WHERE consultation_id IN (SELECT id FROM "Consultation" WHERE patient_id = $1)', [patientId]);
        await pool.query('DELETE FROM "Consultation" WHERE patient_id = $1', [patientId]);
        await pool.query('DELETE FROM "InvestigationOrder" WHERE patient_id = $1', [patientId]);
        await pool.query('DELETE FROM "Appointment" WHERE patient_id = $1', [patientId]);
        await pool.query('DELETE FROM "Patient" WHERE id = $1', [patientId]);
    }
    if (userId) {
        await pool.query('DELETE FROM "Patient" WHERE owner_user_id = $1', [userId]);
        await pool.query('DELETE FROM "User" WHERE id = $1', [userId]);
    }
    if (otherUserId) {
        await pool.query('DELETE FROM "Patient" WHERE owner_user_id = $1', [otherUserId]);
        await pool.query('DELETE FROM "User" WHERE id = $1', [otherUserId]);
    }
    if (doctorId) {
        await pool.query('DELETE FROM "Doctor" WHERE id = $1', [doctorId]);
    }
    if (adminId) {
        await pool.query('DELETE FROM "Admin" WHERE id = $1', [adminId]);
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
        // First entry should be emergency due to priority 10 vs 1
        expect(data.queue[0].id).toBe(emergencyQueueEntryId);
        expect(data.queue[0].type).toBe("EMERGENCY");
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
    });

    it("POST /queue/:queueEntryId/start - doctor starts serving patient (SERVING)", async () => {
        const res = await fetch(`${baseUrl}/queue/${emergencyQueueEntryId}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("SERVING");
    });

    it("POST /doctors/queue/:queueEntryId/complete - doctor completes consultation (COMPLETED)", async () => {
        const res = await fetch(`${baseUrl}/doctors/queue/${emergencyQueueEntryId}/complete`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("COMPLETED");
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
    const nurseEmail = `nurse_${Date.now()}@example.com`;
    const nursePassword = "NursePassword123!";

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
});

describe("Doctor Creation via Admin & Department Hierarchy", () => {
    const newDocEmail = `doc_admin_${Date.now()}@example.com`;
    const newDocPassword = "NewDoctorPassword123!";
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
            'SELECT s.user_id FROM "Staff" s JOIN "Doctor" d ON d.staff_id = s.id WHERE d.id = $1',
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
