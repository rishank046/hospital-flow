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
    const userRes = await pool.query(
        `INSERT INTO "User" (name, email, password)
         VALUES ($1, $2, $3)
         RETURNING id, name, email`,
        ["John Connor", patientEmail, patientPassword]
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
        { userId, email: patientEmail, role: "PATIENT" },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: "4h" }
    );
});

afterAll(async () => {
    // Cleanup seeded data
    if (patientId) {
        await pool.query('DELETE FROM "Patient" WHERE id = $1', [patientId]);
    }
    if (userId) {
        await pool.query('DELETE FROM "User" WHERE id = $1', [userId]);
    }
    if (doctorId) {
        await pool.query('DELETE FROM "Doctor" WHERE id = $1', [doctorId]);
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

describe("Queue Endpoints Preservation", () => {
    it("GET /patients/me/queue - should return 501 Not Implemented", async () => {
        const res = await fetch(`${baseUrl}/patients/me/queue`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(501);
    });

    it("GET /doctors/me/queue - should return 501 Not Implemented", async () => {
        const res = await fetch(`${baseUrl}/doctors/me/queue`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(501);
    });

    it("POST /doctors/queue/123/complete - should return 501 Not Implemented", async () => {
        const res = await fetch(`${baseUrl}/doctors/queue/123/complete`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(501);
    });

    it("POST /doctors/queue/123/skip - should return 501 Not Implemented", async () => {
        const res = await fetch(`${baseUrl}/doctors/queue/123/skip`, {
            method: "POST",
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(501);
    });
});

describe("Role-Based Authorization Enforcement", () => {
    it("Patient token cannot access doctor-only routes", async () => {
        const res = await fetch(`${baseUrl}/doctors/me`, {
            headers: { Authorization: `Bearer ${patientToken}` },
        });

        expect(res.status).toBe(403);
    });

    it("Doctor token cannot access patient-only routes", async () => {
        const res = await fetch(`${baseUrl}/patients/me`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });

        expect(res.status).toBe(403);
    });
});
