import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";

describe("Admin Staff Onboarding Flow", { timeout: 30000 }, () => {
    let server: http.Server;
    let baseUrl: string;
    const jwtSecret = process.env.JWT_SECRET!;
    const testTag = Date.now();

    // Admin
    const adminEmail = `admin_onboarding_${testTag}@example.com`;
    const adminPassword = "AdminPassword123!";
    let adminToken: string;
    let adminId: string;

    const rolesToTest = [
        "NURSE",
        "PHARMACIST",
        "LAB_TECH",
        "RECEPTIONIST",
        "BILLING_CLERK",
        "DOCTOR",
    ] as const;

    interface CreatedStaffEntry {
        role: string;
        email: string;
        staffId: string;
        userId: string;
        tempPassword: string;
        doctorId?: string;
        specialization?: string;
        licenseNumber?: string;
    }

    const createdStaffMap = new Map<string, CreatedStaffEntry>();

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

        // Seed Admin user
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
        const adminRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'ADMIN')
             RETURNING id, name, email`,
            ["Onboarding Admin", adminEmail, hashedAdminPassword]
        );
        adminId = adminRes.rows[0].id;
        adminToken = jwt.sign(
            { userId: adminId, email: adminEmail, role: "ADMIN" },
            jwtSecret,
            { expiresIn: "4h" }
        );
    });

    afterAll(async () => {
        // Cleanup all created records
        const emails: string[] = [];
        for (const entry of createdStaffMap.values()) {
            emails.push(entry.email);
        }

        if (emails.length > 0) {
            await pool.query('DELETE FROM "doctors" WHERE staff_id IN (SELECT id FROM "staff_profiles" WHERE user_id IN (SELECT id FROM "users" WHERE email = ANY($1)))', [emails]);
            await pool.query('DELETE FROM "staff_profiles" WHERE user_id IN (SELECT id FROM "users" WHERE email = ANY($1))', [emails]);
            await pool.query('DELETE FROM "users" WHERE email = ANY($1)', [emails]);
        }

        if (adminId) {
            await pool.query('DELETE FROM "users" WHERE id = $1', [adminId]);
        }

        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        await pool.end();
    });

    it("1. POST /admin/staff for each staffRole (NURSE, PHARMACIST, LAB_TECH, RECEPTIONIST, BILLING_CLERK, DOCTOR) returns 201 & temp password", async () => {
        for (const role of rolesToTest) {
            const email = `staff_${role.toLowerCase()}_${testTag}@example.com`;
            const payload: Record<string, any> = {
                name: `Staff Member ${role}`,
                email,
                role,
                department: `${role} Department`,
            };

            if (role === "DOCTOR") {
                payload.specialization = "Cardiology";
                payload.licenseNumber = `LIC-DOC-${testTag}`;
            }

            const res = await fetch(`${baseUrl}/admin/staff`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify(payload),
            });

            expect(res.status).toBe(201);
            const data = await res.json();

            expect(data.temporaryPassword).toBeDefined();
            expect(typeof data.temporaryPassword).toBe("string");
            expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(8);

            expect(data.staff).toBeDefined();
            expect(data.staff.role).toBe(role);
            expect(data.user).toBeDefined();
            expect(data.user.email).toBe(email);
            expect(data.user.is_active || data.user.isActive).toBe(true);

            createdStaffMap.set(role, {
                role,
                email,
                staffId: data.staff.id,
                userId: data.user.id,
                tempPassword: data.temporaryPassword,
                ...(role === "DOCTOR"
                    ? {
                          doctorId: data.doctor?.id,
                          specialization: "Cardiology",
                          licenseNumber: `LIC-DOC-${testTag}`,
                      }
                    : {}),
            });
        }

        expect(createdStaffMap.size).toBe(rolesToTest.length);
    });

    it("2. For DOCTOR staffRole, verify linked doctors row was created with submitted specialization & license_number", async () => {
        const doctorEntry = createdStaffMap.get("DOCTOR");
        expect(doctorEntry).toBeDefined();

        const docRes = await pool.query(
            `SELECT d.*, u.email 
             FROM "doctors" d 
             JOIN "staff_profiles" s ON d.staff_id = s.id 
             JOIN "users" u ON s.user_id = u.id 
             WHERE d.staff_id = $1`,
            [doctorEntry!.staffId]
        );

        expect(docRes.rows.length).toBe(1);
        const docRow = docRes.rows[0];
        expect(docRow.specialization).toBe("Cardiology");
        expect(docRow.license_number).toBe(doctorEntry!.licenseNumber);
        expect(docRow.email).toBe(doctorEntry!.email);
    });

    it("3. Immediately log in as each newly created account via POST /auth/login using temp password -> 200 & correct JWT payload", async () => {
        for (const role of rolesToTest) {
            const entry = createdStaffMap.get(role)!;
            expect(entry).toBeDefined();

            const res = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: entry.email,
                    password: entry.tempPassword,
                }),
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.token).toBeDefined();
            expect(body.user).toBeDefined();
            expect(body.user.role).toBe("STAFF");
            expect(body.user.staffRole).toBe(role);

            // Verify JWT claims
            const decoded = jwt.decode(body.token) as any;
            expect(decoded.role).toBe("STAFF");
            expect(decoded.staffRole).toBe(role);
            expect(decoded.userId).toBe(entry.userId);
            expect(decoded.email).toBe(entry.email);
        }
    });

    it("4. Attempt self-registration with role=STAFF, role=ADMIN, or role=DOCTOR via POST /auth/register -> rejected (400/403)", async () => {
        const forbiddenRoles = ["STAFF", "ADMIN", "DOCTOR"];

        for (const badRole of forbiddenRoles) {
            const res = await fetch(`${baseUrl}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `Infiltrator ${badRole}`,
                    email: `infiltrator_${badRole.toLowerCase()}_${testTag}@example.com`,
                    password: "SneakyPassword123!",
                    role: badRole,
                }),
            });

            expect([400, 403]).toContain(res.status);
            const err = await res.json();
            expect(JSON.stringify(err)).toMatch(/not permitted|invalid|forbidden/i);
        }
    });

    it("5. PATCH /admin/staff/:staffId/status to ON_LEAVE then INACTIVE -> sets users.is_active=false and blocks login", async () => {
        const nurseEntry = createdStaffMap.get("NURSE")!;
        expect(nurseEntry).toBeDefined();

        // 5a. Update to ON_LEAVE
        const leaveRes = await fetch(`${baseUrl}/admin/staff/${nurseEntry.staffId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "ON_LEAVE" }),
        });

        expect(leaveRes.status).toBe(200);
        const leaveData = await leaveRes.json();
        expect(leaveData.status).toBe("ON_LEAVE");

        const leaveStaffCheck = await pool.query(
            'SELECT status FROM "staff_profiles" WHERE id = $1',
            [nurseEntry.staffId]
        );
        expect(leaveStaffCheck.rows[0].status).toBe("ON_LEAVE");

        // 5b. Update to INACTIVE
        const inactiveRes = await fetch(`${baseUrl}/admin/staff/${nurseEntry.staffId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "INACTIVE" }),
        });

        expect(inactiveRes.status).toBe(200);
        const inactiveData = await inactiveRes.json();
        expect(inactiveData.status).toBe("INACTIVE");

        // Verify Staff table status
        const staffCheck = await pool.query(
            'SELECT status FROM "staff_profiles" WHERE id = $1',
            [nurseEntry.staffId]
        );
        expect(staffCheck.rows[0].status).toBe("INACTIVE");

        // Verify User table is_active is flipped to false
        const userCheck = await pool.query(
            'SELECT is_active FROM "users" WHERE id = $1',
            [nurseEntry.userId]
        );
        expect(userCheck.rows[0].is_active).toBe(false);

        // 5c. Login attempt afterward must fail
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: nurseEntry.email,
                password: nurseEntry.tempPassword,
            }),
        });

        expect([401, 403]).toContain(loginRes.status);
        const loginErr = await loginRes.json();
        expect(JSON.stringify(loginErr)).toMatch(/inactive|disabled|forbidden/i);
    });
});
