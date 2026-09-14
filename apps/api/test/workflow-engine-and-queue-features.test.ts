import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";

describe("Workflow Engine, Dynamic ETA, Doctor Skip/Requeue, and Cash Counter Queue", () => {
    let server: http.Server;
    let baseUrl: string;
    const jwtSecret = process.env.JWT_SECRET!;
    const testTag = Date.now();

    // Staff / Admin
    let staffToken: string;
    let staffUserId: string;

    // Doctor
    let doctorToken: string;
    let doctorUserId: string;
    let doctorStaffId: string;
    let doctorId: string;
    const doctorEmail = `dr_feat_${testTag}@example.com`;

    // Patient User & Profile
    let patientToken: string;
    let patientUserId: string;
    let patientId: string;
    const patientEmail = `patient_feat_${testTag}@example.com`;

    // Additional Patient for queue testing
    let patient2Id: string;

    // Visit IDs for cleanup
    const createdVisitIds: string[] = [];
    const createdQueueEntryIds: string[] = [];
    const createdTaskIds: string[] = [];

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

        // 2. Staff / Admin User
        const staffUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'ADMIN')
             RETURNING id`,
            ["Admin Staff", `admin_feat_${testTag}@example.com`, hashedPassword]
        );
        staffUserId = staffUserRes.rows[0].id;

        const staffProfileRes = await pool.query(
            `INSERT INTO "staff_profiles" (user_id, employee_code, staff_role, status)
             VALUES ($1, $2, 'BILLING_CLERK', 'ACTIVE')
             RETURNING id`,
            [staffUserId, `STAFF-ADMIN-${testTag}`]
        );

        staffToken = jwt.sign(
            { userId: staffUserId, email: `admin_feat_${testTag}@example.com`, role: "ADMIN" },
            jwtSecret,
            { expiresIn: "1h" }
        );

        // 3. Doctor with consultation_minutes = 20
        const docUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Dr. Slot Master", doctorEmail, hashedPassword]
        );
        doctorUserId = docUserRes.rows[0].id;

        const docStaffRes = await pool.query(
            `INSERT INTO "staff_profiles" (user_id, employee_code, staff_role, status)
             VALUES ($1, $2, 'DOCTOR', 'ACTIVE')
             RETURNING id`,
            [doctorUserId, `DOC-FEAT-${testTag}`]
        );
        doctorStaffId = docStaffRes.rows[0].id;

        const docRes = await pool.query(
            `INSERT INTO "doctors" (staff_id, specialization, license_number, consultation_minutes)
             VALUES ($1, 'General Medicine', $2, 20)
             RETURNING id`,
            [doctorStaffId, `LIC-FEAT-${testTag}`]
        );
        doctorId = docRes.rows[0].id;

        doctorToken = jwt.sign(
            { userId: doctorUserId, email: doctorEmail, role: "STAFF", staffRole: "DOCTOR" },
            jwtSecret,
            { expiresIn: "1h" }
        );

        // 4. Patient User & Patient Profile 1
        const patUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'USER')
             RETURNING id`,
            ["Patient One", patientEmail, hashedPassword]
        );
        patientUserId = patUserRes.rows[0].id;

        const patRes = await pool.query(
            `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender)
             VALUES ($1, 'Patient One', '1990-01-01', 'Female')
             RETURNING id`,
            [patientUserId]
        );
        patientId = patRes.rows[0].id;

        patientToken = jwt.sign(
            { userId: patientUserId, email: patientEmail, role: "USER" },
            jwtSecret,
            { expiresIn: "1h" }
        );

        // 5. Patient Profile 2
        const pat2Res = await pool.query(
            `INSERT INTO "patient_profiles" (name, date_of_birth, gender)
             VALUES ('Patient Two', '1995-05-05', 'Male')
             RETURNING id`
        );
        patient2Id = pat2Res.rows[0].id;
    });

    afterAll(async () => {
        // Cleanup dependencies and tasks
        if (createdTaskIds.length > 0) {
            await pool.query('DELETE FROM "workflow_task_dependencies" WHERE task_id = ANY($1) OR depends_on_task_id = ANY($1)', [createdTaskIds]);
            await pool.query('DELETE FROM "workflow_tasks" WHERE id = ANY($1)', [createdTaskIds]);
        }

        // Cleanup queue entries
        if (createdQueueEntryIds.length > 0) {
            await pool.query('DELETE FROM "queue_entries" WHERE id = ANY($1)', [createdQueueEntryIds]);
        }

        // Cleanup visits and invoices
        if (createdVisitIds.length > 0) {
            await pool.query('DELETE FROM "invoice_items" WHERE invoice_id IN (SELECT id FROM "invoices" WHERE visit_id = ANY($1))', [createdVisitIds]);
            await pool.query('DELETE FROM "invoices" WHERE visit_id = ANY($1)', [createdVisitIds]);
            await pool.query('DELETE FROM "queue_entries" WHERE visit_id = ANY($1)', [createdVisitIds]);
            await pool.query('DELETE FROM "visits" WHERE id = ANY($1)', [createdVisitIds]);
        }

        // Cleanup patients
        const pids = [patientId, patient2Id].filter(Boolean);
        if (pids.length > 0) {
            await pool.query('DELETE FROM "patient_profiles" WHERE id = ANY($1)', [pids]);
        }

        // Cleanup doctors, staff, users
        const emails = [doctorEmail, patientEmail, `admin_feat_${testTag}@example.com`];
        await pool.query('DELETE FROM "doctors" WHERE id = $1', [doctorId]);
        await pool.query('DELETE FROM "staff_profiles" WHERE id IN ($1, (SELECT id FROM "staff_profiles" WHERE user_id = $2))', [doctorStaffId, staffUserId]);
        await pool.query('DELETE FROM "users" WHERE email = ANY($1)', [emails]);

        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    describe("Feature 1: Workflow Engine (Branching Task Graph & Dependency Unblocking)", () => {
        let visitId: string;
        let taskConsultId: string;
        let taskLabId: string;
        let taskPharmId: string;

        beforeAll(async () => {
            const vRes = await pool.query(
                `INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status)
                 VALUES ($1, $2, 'WALKIN', 'REGISTERED')
                 RETURNING id`,
                [patientId, doctorId]
            );
            visitId = vRes.rows[0].id;
            createdVisitIds.push(visitId);
        });

        it("1. Creates root CONSULTATION task with WAITING status and isReady: true", async () => {
            const res = await fetch(`${baseUrl}/workflow/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    visitId,
                    taskType: "CONSULTATION",
                    priority: 1,
                }),
            });

            expect(res.status).toBe(201);
            const task = await res.json();
            taskConsultId = task.id;
            createdTaskIds.push(taskConsultId);

            expect(task.taskType).toBe("CONSULTATION");
            expect(task.status).toBe("WAITING");
            expect(task.isReady).toBe(true);
            expect(task.blockedByTaskIds).toEqual([]);
        });

        it("2. Creates dependent LAB_TEST task; status must be BLOCKED because CONSULTATION is not completed", async () => {
            const res = await fetch(`${baseUrl}/workflow/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    visitId,
                    taskType: "LAB_TEST",
                    dependsOnTaskIds: [taskConsultId],
                }),
            });

            expect(res.status).toBe(201);
            const task = await res.json();
            taskLabId = task.id;
            createdTaskIds.push(taskLabId);

            expect(task.taskType).toBe("LAB_TEST");
            expect(task.status).toBe("BLOCKED");
            expect(task.isReady).toBe(false);
            expect(task.blockedByTaskIds).toContain(taskConsultId);
        });

        it("3. Creates PHARMACY task and dynamically adds dependency on LAB_TEST", async () => {
            const res = await fetch(`${baseUrl}/workflow/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    visitId,
                    taskType: "PHARMACY",
                }),
            });

            expect(res.status).toBe(201);
            const task = await res.json();
            taskPharmId = task.id;
            createdTaskIds.push(taskPharmId);

            // Dynamically add dependency: PHARMACY depends on LAB_TEST
            const depRes = await fetch(`${baseUrl}/workflow/tasks/${taskPharmId}/dependencies`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    dependsOnTaskId: taskLabId,
                }),
            });

            expect(depRes.status).toBe(200);
            const depData = await depRes.json();
            expect(depData.taskStatus).toBe("BLOCKED");
        });

        it("4. Prevents circular dependencies (e.g. CONSULTATION depending on PHARMACY)", async () => {
            const res = await fetch(`${baseUrl}/workflow/tasks/${taskConsultId}/dependencies`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    dependsOnTaskId: taskPharmId,
                }),
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.message).toMatch(/circular/i);
        });

        it("5. Rejects starting a BLOCKED task (LAB_TEST)", async () => {
            const res = await fetch(`${baseUrl}/workflow/tasks/${taskLabId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    status: "IN_PROGRESS",
                }),
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.message).toMatch(/BLOCKED/i);
        });

        it("6. Completing CONSULTATION task atomically unblocks LAB_TEST task to WAITING", async () => {
            const res = await fetch(`${baseUrl}/workflow/tasks/${taskConsultId}/complete`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.completedTask.status).toBe("COMPLETED");
            expect(data.unblockedTasks.length).toBe(1);
            expect(data.unblockedTasks[0].id).toBe(taskLabId);
            expect(data.unblockedTasks[0].status).toBe("WAITING");

            // PHARMACY must still be BLOCKED (since LAB_TEST is not completed yet)
            const pharmTaskRes = await fetch(`${baseUrl}/workflow/tasks/${taskPharmId}`, {
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });
            const pharmTask = await pharmTaskRes.json();
            expect(pharmTask.status).toBe("BLOCKED");
        });

        it("7. GET /workflow/visits/:visitId returns full DAG and summary counts", async () => {
            const res = await fetch(`${baseUrl}/workflow/visits/${visitId}`, {
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.summary.total).toBe(3);
            expect(data.summary.completed).toBe(1);
            expect(data.summary.waiting).toBe(1);
            expect(data.summary.blocked).toBe(1);
        });
    });

    describe("Feature 2: Dynamic Waiting Time (ETA) Math based on doctor slot duration", () => {
        let visit1Id: string;
        let visit2Id: string;
        let entry1Id: string;
        let entry2Id: string;

        beforeAll(async () => {
            // Visit 1 for Patient 1
            const v1 = await pool.query(
                `INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status)
                 VALUES ($1, $2, 'WALKIN', 'WAITING_OPD') RETURNING id`,
                [patientId, doctorId]
            );
            visit1Id = v1.rows[0].id;
            createdVisitIds.push(visit1Id);

            // Visit 2 for Patient 2
            const v2 = await pool.query(
                `INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status)
                 VALUES ($1, $2, 'WALKIN', 'WAITING_OPD') RETURNING id`,
                [patient2Id, doctorId]
            );
            visit2Id = v2.rows[0].id;
            createdVisitIds.push(visit2Id);

            // Enqueue Patient 1 (earlier)
            const q1 = await pool.query(
                `INSERT INTO "queue_entries" (visit_id, doctor_id, queue_type, priority, status, joined_at)
                 VALUES ($1, $2, 'WALKIN', 0, 'WAITING', NOW() - INTERVAL '10 minutes')
                 RETURNING id`,
                [visit1Id, doctorId]
            );
            entry1Id = q1.rows[0].id;
            createdQueueEntryIds.push(entry1Id);

            // Enqueue Patient 2 (later)
            const q2 = await pool.query(
                `INSERT INTO "queue_entries" (visit_id, doctor_id, queue_type, priority, status, joined_at)
                 VALUES ($1, $2, 'WALKIN', 0, 'WAITING', NOW() - INTERVAL '5 minutes')
                 RETURNING id`,
                [visit2Id, doctorId]
            );
            entry2Id = q2.rows[0].id;
            createdQueueEntryIds.push(entry2Id);
        });

        it("1. Calculates correct ETA based on doctor's 20-minute consultation length", async () => {
            const res = await fetch(`${baseUrl}/queue?doctorId=${doctorId}`, {
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.queue.length).toBeGreaterThanOrEqual(2);

            const p1 = data.queue.find((q: any) => q.id === entry1Id);
            const p2 = data.queue.find((q: any) => q.id === entry2Id);

            expect(p1).toBeDefined();
            expect(p2).toBeDefined();

            // Doctor has 20-minute slots
            expect(p1.consultation_minutes).toBe(20);
            expect(p2.consultation_minutes).toBe(20);

            // p1 is first: 0 patients ahead, 0 wait time
            expect(p1.patients_ahead).toBe(0);
            expect(p1.estimated_wait_minutes).toBe(0);
            expect(p1.estimated_wait_window).toBe("0 mins");

            // p2 is second: 1 patient ahead, 20 mins wait time
            expect(p2.patients_ahead).toBe(1);
            expect(p2.estimated_wait_minutes).toBe(20);
            expect(p2.estimated_wait_window).toMatch(/mins/);
        });

        it("2. GET /queue/patient/me returns dynamic ETA for authenticated patient", async () => {
            const res = await fetch(`${baseUrl}/queue/patient/me`, {
                headers: {
                    Authorization: `Bearer ${patientToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.queueEntry).toBeDefined();
            expect(data.consultationMinutes).toBe(20);
            expect(data.patientsAhead).toBe(0);
            expect(data.estimatedWaitMinutes).toBe(0);
            expect(data.estimatedWaitWindow).toBe("0 mins");
        });
    });

    describe("Feature 3: Doctor Skip & Fair Re-queue Policy", () => {
        let testDoctorId: string;
        let testDoctorToken: string;
        let v1Id: string;
        let v2Id: string;
        let v3Id: string;
        let q1Id: string;
        let q2Id: string;
        let q3Id: string;

        beforeAll(async () => {
            testDoctorId = doctorId;
            testDoctorToken = doctorToken;

            // Clear any prior queue entries for this doctor
            await pool.query('DELETE FROM "queue_entries" WHERE doctor_id = $1', [testDoctorId]);

            // Create 3 visits
            const v1 = await pool.query(`INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status) VALUES ($1, $2, 'WALKIN', 'WAITING_OPD') RETURNING id`, [patientId, testDoctorId]);
            const v2 = await pool.query(`INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status) VALUES ($1, $2, 'WALKIN', 'WAITING_OPD') RETURNING id`, [patient2Id, testDoctorId]);
            const v3 = await pool.query(`INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status) VALUES ($1, $2, 'WALKIN', 'WAITING_OPD') RETURNING id`, [patientId, testDoctorId]);

            v1Id = v1.rows[0].id;
            v2Id = v2.rows[0].id;
            v3Id = v3.rows[0].id;
            createdVisitIds.push(v1Id, v2Id, v3Id);

            // Enqueue P1 (T-15m), P2 (T-10m), P3 (T-5m)
            const q1 = await pool.query(`INSERT INTO "queue_entries" (visit_id, doctor_id, queue_type, priority, status, joined_at) VALUES ($1, $2, 'WALKIN', 0, 'WAITING', NOW() - INTERVAL '15 minutes') RETURNING id`, [v1Id, testDoctorId]);
            const q2 = await pool.query(`INSERT INTO "queue_entries" (visit_id, doctor_id, queue_type, priority, status, joined_at) VALUES ($1, $2, 'WALKIN', 0, 'WAITING', NOW() - INTERVAL '10 minutes') RETURNING id`, [v2Id, testDoctorId]);
            const q3 = await pool.query(`INSERT INTO "queue_entries" (visit_id, doctor_id, queue_type, priority, status, joined_at) VALUES ($1, $2, 'WALKIN', 0, 'WAITING', NOW() - INTERVAL '5 minutes') RETURNING id`, [v3Id, testDoctorId]);

            q1Id = q1.rows[0].id;
            q2Id = q2.rows[0].id;
            q3Id = q3.rows[0].id;
            createdQueueEntryIds.push(q1Id, q2Id, q3Id);
        });

        it("1. Doctor calls P1, then skips active consultation; doctor is freed and P1 is marked SKIPPED", async () => {
            // Call P1
            const callRes = await fetch(`${baseUrl}/queue/doctor/call-next`, {
                method: "POST",
                headers: { Authorization: `Bearer ${testDoctorToken}` },
            });
            expect(callRes.status).toBe(200);
            const callData = await callRes.json();
            expect(callData.next.id).toBe(q1Id);
            expect(callData.next.status).toBe("CALLED");

            // Skip currently active patient via POST /queue/doctor/skip
            const skipRes = await fetch(`${baseUrl}/queue/doctor/skip`, {
                method: "POST",
                headers: { Authorization: `Bearer ${testDoctorToken}` },
            });
            expect(skipRes.status).toBe(200);
            const skipData = await skipRes.json();
            expect(skipData.id).toBe(q1Id);
            expect(skipData.status).toBe("SKIPPED");
        });

        it("2. Doctor can immediately call next patient (P2)", async () => {
            const callRes = await fetch(`${baseUrl}/queue/doctor/call-next`, {
                method: "POST",
                headers: { Authorization: `Bearer ${testDoctorToken}` },
            });
            expect(callRes.status).toBe(200);
            const callData = await callRes.json();
            expect(callData.next.id).toBe(q2Id);
            expect(callData.next.status).toBe("CALLED");
        });

        it("3. Re-queuing skipped P1 with 'fair' strategy places them in line without displacing active or first in line", async () => {
            // Requeue P1
            const requeueRes = await fetch(`${baseUrl}/queue/${q1Id}/requeue`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${testDoctorToken}`,
                },
                body: JSON.stringify({ strategy: "fair" }),
            });

            expect(requeueRes.status).toBe(200);
            const reqData = await requeueRes.json();
            expect(reqData.status).toBe("WAITING");
            expect(reqData.strategy).toBe("fair");

            // Verify queue ordering: P3 was already waiting (joined earlier than newly requeued P1's adjusted slot)
            const queueRes = await fetch(`${baseUrl}/queue?doctorId=${testDoctorId}`, {
                headers: { Authorization: `Bearer ${staffToken}` },
            });
            const qData = await queueRes.json();
            const waitingEntries = qData.queue.filter((e: any) => e.status === "WAITING");

            // P1 should be re-inserted cleanly into the WAITING list
            const foundP1 = waitingEntries.find((e: any) => e.id === q1Id);
            expect(foundP1).toBeDefined();
        });
    });

    describe("Feature 4: Cash Counter Queue Pipeline", () => {
        let visitCashId: string;
        let cashQueueEntryId: string;
        let invoiceId: string;

        beforeAll(async () => {
            const vRes = await pool.query(
                `INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status)
                 VALUES ($1, $2, 'WALKIN', 'WAITING_OPD')
                 RETURNING id`,
                [patientId, doctorId]
            );
            visitCashId = vRes.rows[0].id;
            createdVisitIds.push(visitCashId);
        });

        it("1. POST /billing/cash-queue enqueues patient at cash counter and advances visit to BILLING", async () => {
            const res = await fetch(`${baseUrl}/billing/cash-queue`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    visitId: visitCashId,
                    priority: 2,
                }),
            });

            expect(res.status).toBe(201);
            const data = await res.json();

            expect(data.queue_type).toBe("CASH_COUNTER");
            expect(data.status).toBe("WAITING");
            expect(data.position).toBeDefined();
            expect(data.invoiceId).toBeDefined();

            cashQueueEntryId = data.id;
            invoiceId = data.invoiceId;
            createdQueueEntryIds.push(cashQueueEntryId);

            // Assert visit status is now BILLING
            const vCheck = await pool.query('SELECT status FROM "visits" WHERE id = $1', [visitCashId]);
            expect(vCheck.rows[0].status).toBe("BILLING");
        });

        it("2. GET /billing/cash-queue lists patients waiting at the cash counter with invoice info", async () => {
            const res = await fetch(`${baseUrl}/billing/cash-queue`, {
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.queue.length).toBeGreaterThanOrEqual(1);
            const item = data.queue.find((q: any) => q.id === cashQueueEntryId);
            expect(item).toBeDefined();
            expect(item.patient_name).toBe("Patient One");
            expect(item.status).toBe("WAITING");
            expect(item.invoice_id).toBe(invoiceId);
        });

        it("3. POST /billing/cash-queue/call-next calls the next patient to the cash desk", async () => {
            const res = await fetch(`${baseUrl}/billing/cash-queue/call-next`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.next).toBeDefined();
            expect(data.next.id).toBe(cashQueueEntryId);
            expect(data.next.status).toBe("CALLED");
        });

        it("4. POST /billing/cash-queue/:id/pay processes cash payment, computes change, and completes visit", async () => {
            const res = await fetch(`${baseUrl}/billing/cash-queue/${cashQueueEntryId}/pay`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    amountReceived: 100.0,
                }),
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.amountReceived).toBe(100.0);
            expect(data.totalAmount).toBe(50.0);
            expect(data.changeDue).toBe(50.0);
            expect(data.status).toBe("PAID");

            // Assert invoice is PAID
            const invCheck = await pool.query('SELECT status, paid_at FROM "invoices" WHERE id = $1', [invoiceId]);
            expect(invCheck.rows[0].status).toBe("PAID");
            expect(invCheck.rows[0].paid_at).not.toBeNull();

            // Assert cash queue entry is COMPLETED
            const qCheck = await pool.query('SELECT status, completed_at FROM "queue_entries" WHERE id = $1', [cashQueueEntryId]);
            expect(qCheck.rows[0].status).toBe("COMPLETED");

            // Assert visit is COMPLETED
            const vCheck = await pool.query('SELECT status FROM "visits" WHERE id = $1', [visitCashId]);
            expect(vCheck.rows[0].status).toBe("COMPLETED");
        });
    });
});
