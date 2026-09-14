import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";
import {
    VALID_TRANSITIONS,
    validateStatusTransition,
} from "#modules/visits/visits.service.js";
import type { VisitStatus } from "#modules/visits/visits.schema.js";

describe("Visit Status Transitions - Validator & Endpoint Enforcement", { timeout: 30000 }, () => {
    let server: http.Server;
    let baseUrl: string;
    const jwtSecret = process.env.JWT_SECRET!;
    const testTag = Date.now();

    // Staff user for performing transitions
    const staffEmail = `staff_trans_${testTag}@example.com`;
    let staffToken: string;
    let staffUserId: string;
    let staffId: string;

    // Patient
    let patientId: string;
    const createdVisitIds: string[] = [];

    const ALL_STATUSES: VisitStatus[] = [
        "REGISTERED",
        "VITALS",
        "WAITING_OPD",
        "IN_CONSULTATION",
        "DIAGNOSTICS",
        "PHARMACY",
        "BILLING",
        "COMPLETED",
        "CANCELLED",
    ];

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

        // Seed Staff
        const staffUserRes = await pool.query(
            `INSERT INTO "User" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Transition Staff", staffEmail, hashedPassword]
        );
        staffUserId = staffUserRes.rows[0].id;

        const staffRes = await pool.query(
            `INSERT INTO "Staff" (user_id, employee_code, role, status)
             VALUES ($1, $2, 'RECEPTIONIST', 'ACTIVE')
             RETURNING id`,
            [staffUserId, `EMP-TR-${testTag}`]
        );
        staffId = staffRes.rows[0].id;

        staffToken = jwt.sign(
            { userId: staffUserId, email: staffEmail, role: "STAFF", staffRole: "RECEPTIONIST" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // Seed Patient
        const patRes = await pool.query(
            `INSERT INTO "Patient" (name, age, gender, patient_type)
             VALUES ('Transition Patient', 35, 'Other', 'Walkin')
             RETURNING id`,
        );
        patientId = patRes.rows[0].id;
    });

    afterAll(async () => {
        if (createdVisitIds.length > 0) {
            await pool.query('DELETE FROM "visits" WHERE id = ANY($1)', [createdVisitIds]);
        }
        if (patientId) {
            await pool.query('DELETE FROM "Patient" WHERE id = $1', [patientId]);
        }
        if (staffId) {
            await pool.query('DELETE FROM "Staff" WHERE id = $1', [staffId]);
        }
        if (staffUserId) {
            await pool.query('DELETE FROM "User" WHERE id = $1', [staffUserId]);
        }

        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        await pool.end();
    });

    // Helper to create a new visit
    async function createTestVisit(initialStatus: VisitStatus = "REGISTERED"): Promise<string> {
        const res = await pool.query(
            `INSERT INTO "visits" (patient_id, visit_type, status)
             VALUES ($1, 'WALKIN', $2)
             RETURNING id`,
            [patientId, initialStatus]
        );
        const id = res.rows[0].id;
        createdVisitIds.push(id);
        return id;
    }

    describe("1. Unit Validation Matrix: Table-test every (fromStatus, toStatus) pair", () => {
        it("Validates every (fromStatus, toStatus) against VALID_TRANSITIONS map", () => {
            for (const from of ALL_STATUSES) {
                for (const to of ALL_STATUSES) {
                    const expectedAllowed = VALID_TRANSITIONS[from].includes(to);
                    const actualAllowed = validateStatusTransition(from, to);
                    expect(
                        actualAllowed,
                        `Transition from ${from} to ${to} should be ${expectedAllowed}`
                    ).toBe(expectedAllowed);
                }
            }
        });
    });

    describe("2. HTTP Integration: Legal forward sequence succeeds", () => {
        it("Transitions cleanly through: REGISTERED -> VITALS -> WAITING_OPD -> IN_CONSULTATION -> DIAGNOSTICS -> PHARMACY -> BILLING -> COMPLETED", async () => {
            const vId = await createTestVisit("REGISTERED");

            const sequence: VisitStatus[] = [
                "VITALS",
                "WAITING_OPD",
                "IN_CONSULTATION",
                "DIAGNOSTICS",
                "PHARMACY",
                "BILLING",
                "COMPLETED",
            ];

            for (const nextStatus of sequence) {
                const patchRes = await fetch(`${baseUrl}/visits/${vId}/status`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${staffToken}`,
                    },
                    body: JSON.stringify({ status: nextStatus }),
                });

                expect(patchRes.status).toBe(200);
                const data = await patchRes.json();
                expect(data.status).toBe(nextStatus);
            }
        });
    });

    describe("3. HTTP Integration: Allowed skips succeed", () => {
        it("Allows skip: WAITING_OPD -> BILLING -> COMPLETED", async () => {
            const vId = await createTestVisit("REGISTERED");

            // Advance to WAITING_OPD
            await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });
            await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "WAITING_OPD" }),
            });

            // Skip directly to BILLING
            const billRes = await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(billRes.status).toBe(200);
            const billData = await billRes.json();
            expect(billData.status).toBe("BILLING");

            // Complete
            const compRes = await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "COMPLETED" }),
            });
            expect(compRes.status).toBe(200);
            const compData = await compRes.json();
            expect(compData.status).toBe("COMPLETED");
        });

        it("Allows skip: IN_CONSULTATION -> BILLING -> COMPLETED", async () => {
            const vId = await createTestVisit("IN_CONSULTATION");

            // Skip directly to BILLING (no diagnostics or pharmacy)
            const billRes = await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "BILLING" }),
            });
            expect(billRes.status).toBe(200);
            const billData = await billRes.json();
            expect(billData.status).toBe("BILLING");

            // Complete
            const compRes = await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "COMPLETED" }),
            });
            expect(compRes.status).toBe(200);
            const compData = await compRes.json();
            expect(compData.status).toBe("COMPLETED");
        });
    });

    describe("4. HTTP Integration: Backward transitions rejected with 400", () => {
        it("Rejects BILLING -> VITALS with 400", async () => {
            const vId = await createTestVisit("BILLING");

            const res = await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "VITALS" }),
            });

            expect(res.status).toBe(400);
            const err = await res.json();
            expect(err.message).toMatch(/illegal status transition/i);
        });

        it("Rejects IN_CONSULTATION -> REGISTERED with 400", async () => {
            const vId = await createTestVisit("IN_CONSULTATION");

            const res = await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "REGISTERED" }),
            });

            expect(res.status).toBe(400);
            const err = await res.json();
            expect(err.message).toMatch(/illegal status transition/i);
        });

        it("Rejects PHARMACY -> IN_CONSULTATION with 400", async () => {
            const vId = await createTestVisit("PHARMACY");

            const res = await fetch(`${baseUrl}/visits/${vId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ status: "IN_CONSULTATION" }),
            });

            expect(res.status).toBe(400);
            const err = await res.json();
            expect(err.message).toMatch(/illegal status transition/i);
        });
    });

    describe("5. HTTP Integration: CANCELLED is reachable from every non-terminal status", () => {
        const cancellableStatuses: VisitStatus[] = [
            "REGISTERED",
            "VITALS",
            "WAITING_OPD",
            "IN_CONSULTATION",
            "DIAGNOSTICS",
            "PHARMACY",
            "BILLING",
        ];

        for (const st of cancellableStatuses) {
            it(`Reaches CANCELLED from ${st}`, async () => {
                const vId = await createTestVisit(st);

                const res = await fetch(`${baseUrl}/visits/${vId}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                    body: JSON.stringify({ status: "CANCELLED" }),
                });

                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data.status).toBe("CANCELLED");
            });
        }
    });

    describe("6. HTTP Integration: Terminal statuses allow NO transitions out", () => {
        it("Rejects any transition out of COMPLETED with 400", async () => {
            const vId = await createTestVisit("COMPLETED");

            for (const target of ALL_STATUSES) {
                const res = await fetch(`${baseUrl}/visits/${vId}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                    body: JSON.stringify({ status: target }),
                });

                expect(res.status).toBe(400);
                const err = await res.json();
                expect(err.message).toMatch(/illegal status transition/i);
            }
        });

        it("Rejects any transition out of CANCELLED with 400", async () => {
            const vId = await createTestVisit("CANCELLED");

            for (const target of ALL_STATUSES) {
                const res = await fetch(`${baseUrl}/visits/${vId}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                    body: JSON.stringify({ status: target }),
                });

                expect(res.status).toBe(400);
                const err = await res.json();
                expect(err.message).toMatch(/illegal status transition/i);
            }
        });
    });
});
