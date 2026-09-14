import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";

describe("Role Guards & Authorization Enforcement", { timeout: 30000 }, () => {
    let server: http.Server;
    let baseUrl: string;
    const jwtSecret = process.env.JWT_SECRET!;
    const testTag = Date.now();

    // Doctor Staff
    const doctorEmail = `doc_guard_${testTag}@example.com`;
    let doctorToken: string;
    let doctorUserId: string;
    let doctorStaffId: string;
    let doctorId: string;

    // Nurse Staff
    const nurseEmail = `nurse_guard_${testTag}@example.com`;
    let nurseToken: string;
    let nurseUserId: string;
    let nurseStaffId: string;

    // Patient A
    const patientAEmail = `pat_a_guard_${testTag}@example.com`;
    let patientAToken: string;
    let patientAUserId: string;
    let patientAId: string;

    // Patient B
    const patientBEmail = `pat_b_guard_${testTag}@example.com`;
    let patientBToken: string;
    let patientBUserId: string;
    let patientBId: string;

    // Admin
    const adminEmail = `admin_guard_${testTag}@example.com`;
    let adminToken: string;
    let adminId: string;

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

        const hashedPassword = await bcrypt.hash("Password123!", 10);

        // 1. Seed Doctor (User -> Staff -> Doctor)
        const docUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Dr. Guard Specialist", doctorEmail, hashedPassword]
        );
        doctorUserId = docUserRes.rows[0].id;

        const docStaffRes = await pool.query(
            `INSERT INTO "staff_profiles" (user_id, employee_code, staff_role, status)
             VALUES ($1, $2, 'DOCTOR', 'ACTIVE')
             RETURNING id`,
            [doctorUserId, `DOC-GD-${testTag}`]
        );
        doctorStaffId = docStaffRes.rows[0].id;

        const docRes = await pool.query(
            `INSERT INTO "doctors" (staff_id, specialization, license_number)
             VALUES ($1, 'Cardiology', $2)
             RETURNING id`,
            [doctorStaffId, `LIC-DOC-${testTag}`]
        );
        doctorId = docRes.rows[0].id;

        doctorToken = jwt.sign(
            { userId: doctorUserId, email: doctorEmail, role: "STAFF", staffRole: "DOCTOR" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // 2. Seed Nurse (User -> Staff)
        const nurseUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Nurse Guard", nurseEmail, hashedPassword]
        );
        nurseUserId = nurseUserRes.rows[0].id;

        const nurseStaffRes = await pool.query(
            `INSERT INTO "staff_profiles" (user_id, employee_code, staff_role, status)
             VALUES ($1, $2, 'NURSE', 'ACTIVE')
             RETURNING id`,
            [nurseUserId, `NUR-GD-${testTag}`]
        );
        nurseStaffId = nurseStaffRes.rows[0].id;

        nurseToken = jwt.sign(
            { userId: nurseUserId, email: nurseEmail, role: "STAFF", staffRole: "NURSE" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // 3. Seed Patient A (User -> Patient)
        const patAUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'USER')
             RETURNING id`,
            ["Patient Alpha", patientAEmail, hashedPassword]
        );
        patientAUserId = patAUserRes.rows[0].id;

        const patARes = await pool.query(
            `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender)
             VALUES ($1, 'Patient Alpha', '1994-01-01', 'Female')
             RETURNING id`,
            [patientAUserId]
        );
        patientAId = patARes.rows[0].id;

        patientAToken = jwt.sign(
            { userId: patientAUserId, email: patientAEmail, role: "USER" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // 4. Seed Patient B (User -> Patient)
        const patBUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'USER')
             RETURNING id`,
            ["Patient Beta", patientBEmail, hashedPassword]
        );
        patientBUserId = patBUserRes.rows[0].id;

        const patBRes = await pool.query(
            `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender)
             VALUES ($1, 'Patient Beta', '1982-01-01', 'Male')
             RETURNING id`,
            [patientBUserId]
        );
        patientBId = patBRes.rows[0].id;

        patientBToken = jwt.sign(
            { userId: patientBUserId, email: patientBEmail, role: "PATIENT" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // 5. Seed Admin
        const adminRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'ADMIN')
             RETURNING id`,
            ["Admin Guard", adminEmail, hashedPassword]
        );
        adminId = adminRes.rows[0].id;

        adminToken = jwt.sign(
            { userId: adminId, email: adminEmail, role: "ADMIN" },
            jwtSecret,
            { expiresIn: "4h" }
        );
    });

    afterAll(async () => {
        // Cleanup
        if (patientAId) await pool.query('DELETE FROM "patient_profiles" WHERE id = $1', [patientAId]);
        if (patientBId) await pool.query('DELETE FROM "patient_profiles" WHERE id = $1', [patientBId]);
        if (patientAUserId) await pool.query('DELETE FROM "users" WHERE id = $1', [patientAUserId]);
        if (patientBUserId) await pool.query('DELETE FROM "users" WHERE id = $1', [patientBUserId]);

        if (doctorId) await pool.query('DELETE FROM "doctors" WHERE id = $1', [doctorId]);
        if (doctorStaffId) await pool.query('DELETE FROM "staff_profiles" WHERE id = $1', [doctorStaffId]);
        if (doctorUserId) await pool.query('DELETE FROM "users" WHERE id = $1', [doctorUserId]);

        if (nurseStaffId) {
            await pool.query('DELETE FROM "staff_profiles" WHERE id = $1', [nurseStaffId]);
        }
        if (nurseUserId) await pool.query('DELETE FROM "users" WHERE id = $1', [nurseUserId]);

        if (adminId) await pool.query('DELETE FROM "users" WHERE id = $1', [adminId]);

        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        await pool.end();
    });

    describe("1. DOCTOR staffRole endpoint boundaries", () => {
        it("DOCTOR token calling role-specific pharmacy endpoint (PATCH /prescriptions/:id/dispense) -> 403 Forbidden", async () => {
            const dummyPrescriptionId = "00000000-0000-0000-0000-000000000001";
            const res = await fetch(`${baseUrl}/prescriptions/${dummyPrescriptionId}/dispense`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${doctorToken}`,
                },
                body: JSON.stringify({ quantity: 1 }),
            });

            // requireStaffRole("PHARMACIST") must reject DOCTOR with 403
            expect(res.status).toBe(403);
            const err = await res.json();
            expect(err.message).toMatch(/insufficient staff role|forbidden/i);
        });

        it("DOCTOR token calling shared staff endpoint (GET /staff/me) -> 200 allowed (returns profile with doctor details)", async () => {
            const res = await fetch(`${baseUrl}/staff/me`, {
                headers: {
                    Authorization: `Bearer ${doctorToken}`,
                },
            });

            // requireRole("STAFF") allows DOCTOR since role='STAFF'
            expect(res.status).toBe(200);
            const profile = await res.json();
            expect(profile.staff_role).toBe("DOCTOR");
            expect(profile.doctor_id).toBe(doctorId);
        });

        it("NURSE token calling doctor-only endpoint (POST /queue/doctor/call-next) -> 403 Forbidden", async () => {
            const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${nurseToken}`,
                },
            });

            // requireRole("DOCTOR") rejects NURSE with 403
            expect(res.status).toBe(403);
            const err = await res.json();
            expect(err.message).toMatch(/forbidden|insufficient permissions/i);
        });

        it("DOCTOR token calling doctor-only endpoint (POST /queue/doctor/call-next) -> not blocked by 403", async () => {
            const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${doctorToken}`,
                },
            });

            // Succeeded auth check (may return 200 with next: null if queue empty)
            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(401);
            expect(res.status).toBe(200);
        });
    });

    describe("2. STAFF token (any non-admin staffRole) calling /admin/* endpoints -> 403 Forbidden", () => {
        it("NURSE token calling GET /admin/staff -> 403", async () => {
            const res = await fetch(`${baseUrl}/admin/staff`, {
                headers: { Authorization: `Bearer ${nurseToken}` },
            });
            expect(res.status).toBe(403);
        });

        it("NURSE token calling POST /admin/staff -> 403", async () => {
            const res = await fetch(`${baseUrl}/admin/staff`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nurseToken}`,
                },
                body: JSON.stringify({
                    name: "Hack Staff",
                    email: "hack@example.com",
                    role: "RECEPTIONIST",
                }),
            });
            expect(res.status).toBe(403);
        });

        it("DOCTOR token calling GET /admin/doctors -> 403", async () => {
            const res = await fetch(`${baseUrl}/admin/doctors`, {
                headers: { Authorization: `Bearer ${doctorToken}` },
            });
            expect(res.status).toBe(403);
        });

        it("DOCTOR token calling GET /admin/patients -> 403", async () => {
            const res = await fetch(`${baseUrl}/admin/patients`, {
                headers: { Authorization: `Bearer ${doctorToken}` },
            });
            expect(res.status).toBe(403);
        });
    });

    describe("3. PATIENT token calling /admin/* or /staff/* endpoints -> 403 Forbidden", () => {
        it("PATIENT token calling GET /admin/staff -> 403", async () => {
            const res = await fetch(`${baseUrl}/admin/staff`, {
                headers: { Authorization: `Bearer ${patientAToken}` },
            });
            expect(res.status).toBe(403);
        });

        it("PATIENT token calling GET /admin/doctors -> 403", async () => {
            const res = await fetch(`${baseUrl}/admin/doctors`, {
                headers: { Authorization: `Bearer ${patientAToken}` },
            });
            expect(res.status).toBe(403);
        });

        it("PATIENT token calling GET /staff/me -> 403", async () => {
            const res = await fetch(`${baseUrl}/staff/me`, {
                headers: { Authorization: `Bearer ${patientAToken}` },
            });
            expect(res.status).toBe(403);
        });

        it("PATIENT token calling POST /visits/:id/vitals -> 403", async () => {
            const dummyVisitId = "00000000-0000-0000-0000-000000000001";
            const res = await fetch(`${baseUrl}/visits/${dummyVisitId}/vitals`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${patientAToken}`,
                },
                body: JSON.stringify({ temperature: 37.0 }),
            });
            expect(res.status).toBe(403);
        });
    });

    describe("4. Ownership guard on GET /patients/byId/:patientId", () => {
        it("Patient A querying Patient A's own profile -> 200 OK", async () => {
            const res = await fetch(`${baseUrl}/patients/byId/${patientAId}`, {
                headers: { Authorization: `Bearer ${patientAToken}` },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.id).toBe(patientAId);
            expect(data.name).toBe("Patient Alpha");
        });

        it("Patient A querying Patient B's profile (unowned) -> 403 Forbidden", async () => {
            const res = await fetch(`${baseUrl}/patients/byId/${patientBId}`, {
                headers: { Authorization: `Bearer ${patientAToken}` },
            });

            // Ownership check rejects unauthorized viewer
            expect([403, 404]).toContain(res.status);
            expect(res.status).toBe(403);
            const err = await res.json();
            expect(err.message).toMatch(/forbidden|permission|ownership/i);
        });
    });
});
