import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";

describe("Queue Ordering and Doctor Call-Next Mechanics", () => {
    let server: http.Server;
    let baseUrl: string;
    const jwtSecret = process.env.JWT_SECRET!;
    const testTag = Date.now();

    // Doctor A
    const doctorEmail = `dr_queue_${testTag}@example.com`;
    let doctorToken: string;
    let doctorUserId: string;
    let doctorStaffId: string;
    let doctorId: string;

    // Doctor B (for isolation testing)
    const doctorBEmail = `dr_b_queue_${testTag}@example.com`;
    let doctorBToken: string;
    let doctorBUserId: string;
    let doctorBStaffId: string;
    let doctorBId: string;

    // Patients
    let patient1Id: string;
    let patient2Id: string;
    let patient3Id: string;
    let patientSkippedId: string;
    let patientCompletedId: string;
    let patientDocBId: string;

    // Queue Entries
    let entry1Id: string; // priority 0, joined T1 (earliest)
    let entry2Id: string; // priority 0, joined T2 (middle)
    let entry3Id: string; // priority 5, joined T3 (latest)
    let entrySkippedId: string; // priority 10, status SKIPPED
    let entryCompletedId: string; // priority 10, status COMPLETED
    let entryDocBId: string; // Doctor B's entry

    beforeAll(async () => {
        // 1. Start ephemeral HTTP server
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

        // 2. Seed Doctor A (User -> Staff -> Doctor)
        const docUserRes = await pool.query(
            `INSERT INTO "User" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Dr. Queue Primary", doctorEmail, hashedPassword]
        );
        doctorUserId = docUserRes.rows[0].id;

        const docStaffRes = await pool.query(
            `INSERT INTO "Staff" (user_id, employee_code, role, status)
             VALUES ($1, $2, 'DOCTOR', 'ACTIVE')
             RETURNING id`,
            [doctorUserId, `DOC-Q-${testTag}`]
        );
        doctorStaffId = docStaffRes.rows[0].id;

        const docRes = await pool.query(
            `INSERT INTO "Doctor" (staff_id, specialization, department, name, email)
             VALUES ($1, 'Cardiology', 'Cardiology', 'Dr. Queue Primary', $2)
             RETURNING id`,
            [doctorStaffId, doctorEmail]
        );
        doctorId = docRes.rows[0].id;

        doctorToken = jwt.sign(
            { userId: doctorUserId, email: doctorEmail, role: "STAFF", staffRole: "DOCTOR" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // 3. Seed Doctor B (for queue isolation check)
        const docBUserRes = await pool.query(
            `INSERT INTO "User" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Dr. Queue Secondary", doctorBEmail, hashedPassword]
        );
        doctorBUserId = docBUserRes.rows[0].id;

        const docBStaffRes = await pool.query(
            `INSERT INTO "Staff" (user_id, employee_code, role, status)
             VALUES ($1, $2, 'DOCTOR', 'ACTIVE')
             RETURNING id`,
            [doctorBUserId, `DOC-QB-${testTag}`]
        );
        doctorBStaffId = docBStaffRes.rows[0].id;

        const docBRes = await pool.query(
            `INSERT INTO "Doctor" (staff_id, specialization, department, name, email)
             VALUES ($1, 'Pediatrics', 'Pediatrics', 'Dr. Queue Secondary', $2)
             RETURNING id`,
            [doctorBStaffId, doctorBEmail]
        );
        doctorBId = docBRes.rows[0].id;

        doctorBToken = jwt.sign(
            { userId: doctorBUserId, email: doctorBEmail, role: "STAFF", staffRole: "DOCTOR" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // 4. Seed Patients
        const patRes = await pool.query(
            `INSERT INTO "Patient" (name, age, gender, patient_type)
             VALUES 
                ('Patient One (P0, T1)', 30, 'Male', 'Walkin'),
                ('Patient Two (P0, T2)', 40, 'Female', 'Walkin'),
                ('Patient Three (P5, T3)', 50, 'Other', 'Walkin'),
                ('Patient Skipped (P10)', 60, 'Male', 'Walkin'),
                ('Patient Completed (P10)', 70, 'Female', 'Walkin'),
                ('Patient DocB', 25, 'Male', 'Walkin')
             RETURNING id, name`
        );
        patient1Id = patRes.rows[0].id;
        patient2Id = patRes.rows[1].id;
        patient3Id = patRes.rows[2].id;
        patientSkippedId = patRes.rows[3].id;
        patientCompletedId = patRes.rows[4].id;
        patientDocBId = patRes.rows[5].id;

        // 5. Seed Queue Entries with staggered timestamps and priorities:
        // T1 = 30 mins ago, T2 = 20 mins ago, T3 = 10 mins ago
        // Entry 1: priority 0, joined_at = NOW() - INTERVAL '30 minutes', status = 'WAITING'
        const q1 = await pool.query(
            `INSERT INTO "QueueEntry" (patient_id, doctor_id, priority, status, joined_at, type)
             VALUES ($1, $2, 0, 'WAITING', NOW() - INTERVAL '30 minutes', 'WALK_IN')
             RETURNING id`,
            [patient1Id, doctorId]
        );
        entry1Id = q1.rows[0].id;

        // Entry 2: priority 0, joined_at = NOW() - INTERVAL '20 minutes', status = 'WAITING'
        const q2 = await pool.query(
            `INSERT INTO "QueueEntry" (patient_id, doctor_id, priority, status, joined_at, type)
             VALUES ($1, $2, 0, 'WAITING', NOW() - INTERVAL '20 minutes', 'WALK_IN')
             RETURNING id`,
            [patient2Id, doctorId]
        );
        entry2Id = q2.rows[0].id;

        // Entry 3: priority 5, joined_at = NOW() - INTERVAL '10 minutes', status = 'WAITING'
        // Joined LATER than Entry 1 and 2, but has priority 5 > 0
        const q3 = await pool.query(
            `INSERT INTO "QueueEntry" (patient_id, doctor_id, priority, status, joined_at, type)
             VALUES ($1, $2, 5, 'WAITING', NOW() - INTERVAL '10 minutes', 'WALK_IN')
             RETURNING id`,
            [patient3Id, doctorId]
        );
        entry3Id = q3.rows[0].id;

        // Non-waiting entries for Doctor A to verify skipping
        // Entry Skipped: priority 10, status 'SKIPPED'
        const qSkip = await pool.query(
            `INSERT INTO "QueueEntry" (patient_id, doctor_id, priority, status, joined_at, type)
             VALUES ($1, $2, 10, 'SKIPPED', NOW() - INTERVAL '40 minutes', 'WALK_IN')
             RETURNING id`,
            [patientSkippedId, doctorId]
        );
        entrySkippedId = qSkip.rows[0].id;

        // Entry Completed: priority 10, status 'COMPLETED'
        const qComp = await pool.query(
            `INSERT INTO "QueueEntry" (patient_id, doctor_id, priority, status, joined_at, type)
             VALUES ($1, $2, 10, 'COMPLETED', NOW() - INTERVAL '50 minutes', 'WALK_IN')
             RETURNING id`,
            [patientCompletedId, doctorId]
        );
        entryCompletedId = qComp.rows[0].id;

        // Doctor B's queue entry
        const qB = await pool.query(
            `INSERT INTO "QueueEntry" (patient_id, doctor_id, priority, status, joined_at, type)
             VALUES ($1, $2, 1, 'WAITING', NOW() - INTERVAL '15 minutes', 'WALK_IN')
             RETURNING id`,
            [patientDocBId, doctorBId]
        );
        entryDocBId = qB.rows[0].id;
    });

    afterAll(async () => {
        // Clean up queue entries
        const entryIds = [entry1Id, entry2Id, entry3Id, entrySkippedId, entryCompletedId, entryDocBId].filter(Boolean);
        if (entryIds.length > 0) {
            await pool.query('DELETE FROM "QueueEntry" WHERE id = ANY($1)', [entryIds]);
        }

        // Clean up patients
        const patIds = [patient1Id, patient2Id, patient3Id, patientSkippedId, patientCompletedId, patientDocBId].filter(Boolean);
        if (patIds.length > 0) {
            await pool.query('DELETE FROM "Patient" WHERE id = ANY($1)', [patIds]);
        }

        // Clean up doctors & staff & users
        const emails = [doctorEmail, doctorBEmail];
        await pool.query('DELETE FROM "Doctor" WHERE email = ANY($1)', [emails]);
        await pool.query('DELETE FROM "Staff" WHERE user_id IN (SELECT id FROM "User" WHERE email = ANY($1))', [emails]);
        await pool.query('DELETE FROM "User" WHERE email = ANY($1)', [emails]);

        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        await pool.end();
    });

    it("1. Assert GET /queue?doctorId=... returns entries ordered priority DESC, joined_at ASC", async () => {
        const res = await fetch(`${baseUrl}/queue?doctorId=${doctorId}`, {
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();

        // Default getQueue returns active statuses (WAITING, CALLED, IN_PROGRESS, SERVING)
        // COMPLETED and SKIPPED should not be in the default active queue
        expect(Array.isArray(data.queue)).toBe(true);
        expect(data.queue.length).toBe(3);

        // Ordering check:
        // Position 1: Entry 3 (priority 5, joined latest)
        // Position 2: Entry 1 (priority 0, joined earliest)
        // Position 3: Entry 2 (priority 0, joined second)
        expect(data.queue[0].id).toBe(entry3Id);
        expect(data.queue[0].priority).toBe(5);
        expect(data.queue[0].position).toBe(1);

        expect(data.queue[1].id).toBe(entry1Id);
        expect(data.queue[1].priority).toBe(0);
        expect(data.queue[1].position).toBe(2);

        expect(data.queue[2].id).toBe(entry2Id);
        expect(data.queue[2].priority).toBe(0);
        expect(data.queue[2].position).toBe(3);

        // Initial waitingCount must be 3
        expect(data.waitingCount).toBe(3);
    });

    it("2. Assert GET /queue/doctor/me returns correct queue order and waitingCount = 3 for Doctor A", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/me`, {
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.waitingCount).toBe(3);
        expect(data.queue.length).toBe(3);
        expect(data.queue[0].id).toBe(entry3Id);
        expect(data.queue[1].id).toBe(entry1Id);
        expect(data.queue[2].id).toBe(entry2Id);

        // Isolation: Doctor B's entry should NOT appear in Doctor A's queue
        const docBEntryPresent = data.queue.some((item: any) => item.id === entryDocBId);
        expect(docBEntryPresent).toBe(false);
    });

    it("3. First call to POST /queue/doctor/call-next pulls priority-5 entry first (skipping SKIPPED/COMPLETED)", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const calledEntry = data.next || data;

        // Must be Entry 3 (priority 5), despite joining after Entry 1 and 2, and ignoring priority-10 SKIPPED/COMPLETED
        expect(calledEntry.id).toBe(entry3Id);
        expect(calledEntry.status).toBe("CALLED");
        expect(calledEntry.called_at).toBeTruthy();
    });

    it("4. Assert waitingCount in GET /queue/doctor/me decrements to 2 and currentServing reflects CALLED entry", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/me`, {
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();

        // 1 called, 2 waiting
        expect(data.waitingCount).toBe(2);
        expect(data.currentServing).toBeTruthy();
        expect(data.currentServing.id).toBe(entry3Id);
        expect(data.currentServing.status).toBe("CALLED");
    });

    it("5. Second call to POST /queue/doctor/call-next pulls Entry 1 (priority 0, earlier joined_at)", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const calledEntry = data.next || data;

        // Must be Entry 1 (joined T1 = 30m ago, earlier than Entry 2 at 20m ago)
        expect(calledEntry.id).toBe(entry1Id);
        expect(calledEntry.status).toBe("CALLED");
    });

    it("6. Assert waitingCount in GET /queue/doctor/me decrements to 1", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/me`, {
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.waitingCount).toBe(1);
    });

    it("7. Third call to POST /queue/doctor/call-next pulls Entry 2 (priority 0, later joined_at)", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const calledEntry = data.next || data;

        // Must be Entry 2
        expect(calledEntry.id).toBe(entry2Id);
        expect(calledEntry.status).toBe("CALLED");
    });

    it("8. Assert waitingCount in GET /queue/doctor/me decrements to 0", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/me`, {
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.waitingCount).toBe(0);
    });

    it("9. Fourth call to POST /queue/doctor/call-next returns no patients waiting", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });
        expect(res.status).toBe(200);
        const data = await res.json();

        // No more waiting entries for Doctor A
        expect(data.next).toBeNull();
        expect(data.message).toBe("No patients waiting in queue");
    });

    it("10. Assert Doctor B's queue is unaffected and Doctor B can call their own waiting entry", async () => {
        // Doctor B's queue should still have 1 waiting
        const qbRes = await fetch(`${baseUrl}/queue/doctor/me`, {
            headers: {
                Authorization: `Bearer ${doctorBToken}`,
            },
        });
        expect(qbRes.status).toBe(200);
        const qbData = await qbRes.json();
        expect(qbData.waitingCount).toBe(1);
        expect(qbData.queue[0].id).toBe(entryDocBId);

        // Doctor B calls next
        const callBRes = await fetch(`${baseUrl}/queue/doctor/call-next`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorBToken}`,
            },
        });
        expect(callBRes.status).toBe(200);
        const callBData = await callBRes.json();
        const nextB = callBData.next || callBData;
        expect(nextB.id).toBe(entryDocBId);
        expect(nextB.status).toBe("CALLED");
    });
});
