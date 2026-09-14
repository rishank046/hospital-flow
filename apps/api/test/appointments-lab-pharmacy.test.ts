import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";

describe("Appointments Conflict, Dynamic Slots, Automated Check-in, Lab Tracking, and Pharmacy Gating", () => {
    let server: http.Server;
    let baseUrl: string;
    const jwtSecret = process.env.JWT_SECRET!;
    const testTag = Date.now();

    // Staff
    let staffToken: string;
    let staffUserId: string;

    // Doctor
    let doctorToken: string;
    let doctorUserId: string;
    let doctorStaffId: string;
    let doctorId: string;
    const doctorEmail = `dr_appt_${testTag}@example.com`;

    // Pharmacist
    let pharmacistToken: string;
    let pharmacistUserId: string;
    let pharmacistStaffId: string;

    // Patient 1
    let patient1Token: string;
    let patient1UserId: string;
    let patient1Id: string;
    const patient1Email = `pat1_appt_${testTag}@example.com`;

    // Patient 2
    let patient2Token: string;
    let patient2UserId: string;
    let patient2Id: string;
    const patient2Email = `pat2_appt_${testTag}@example.com`;

    // Cleanup arrays
    const createdAppointmentIds: string[] = [];
    const createdVisitIds: string[] = [];
    const createdQueueEntryIds: string[] = [];
    const createdLabOrderIds: string[] = [];
    const createdPrescriptionIds: string[] = [];
    const createdTaskIds: string[] = [];

    beforeAll(async () => {
        // 1. Start server
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

        // 2. Staff user (ADMIN role for wide permissions)
        const staffUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'ADMIN')
             RETURNING id`,
            ["Admin Staff", `admin_appt_${testTag}@example.com`, hashedPassword]
        );
        staffUserId = staffUserRes.rows[0].id;
        staffToken = jwt.sign(
            { userId: staffUserId, email: `admin_appt_${testTag}@example.com`, role: "ADMIN" },
            jwtSecret,
            { expiresIn: "2h" }
        );

        // 3. Pharmacist user
        const pharmUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Pharm Staff", `pharm_appt_${testTag}@example.com`, hashedPassword]
        );
        pharmacistUserId = pharmUserRes.rows[0].id;
        const pharmStaffRes = await pool.query(
            `INSERT INTO "staff_profiles" (user_id, staff_role, employee_code, status)
             VALUES ($1, 'PHARMACIST', $2, 'ACTIVE')
             RETURNING id`,
            [pharmacistUserId, `EMP-PHARM-${testTag}`]
        );
        pharmacistStaffId = pharmStaffRes.rows[0].id;
        pharmacistToken = jwt.sign(
            { userId: pharmacistUserId, email: `pharm_appt_${testTag}@example.com`, role: "STAFF", staffRole: "PHARMACIST" },
            jwtSecret,
            { expiresIn: "2h" }
        );

        // 4. Doctor user with consultation_minutes = 20
        const docUserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'STAFF')
             RETURNING id`,
            ["Dr. Sarah Specialist", doctorEmail, hashedPassword]
        );
        doctorUserId = docUserRes.rows[0].id;

        const docStaffRes = await pool.query(
            `INSERT INTO "staff_profiles" (user_id, staff_role, employee_code, status)
             VALUES ($1, 'DOCTOR', $2, 'ACTIVE')
             RETURNING id`,
            [doctorUserId, `EMP-DOC-${testTag}`]
        );
        doctorStaffId = docStaffRes.rows[0].id;

        const docRes = await pool.query(
            `INSERT INTO "doctors" (staff_id, specialization, license_number, consultation_minutes)
             VALUES ($1, 'Cardiology', $2, 20)
             RETURNING id`,
            [doctorStaffId, `LIC-APP-${testTag}`]
        );
        doctorId = docRes.rows[0].id;

        doctorToken = jwt.sign(
            { userId: doctorUserId, email: doctorEmail, role: "STAFF", staffRole: "DOCTOR" },
            jwtSecret,
            { expiresIn: "2h" }
        );

        // 5. Patient 1
        const pat1UserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'PATIENT')
             RETURNING id`,
            ["Alice Patient", patient1Email, hashedPassword]
        );
        patient1UserId = pat1UserRes.rows[0].id;

        const pat1Res = await pool.query(
            `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender, mobile_number)
             VALUES ($1, 'Alice Patient', '1990-05-15', 'Female', '555-0101')
             RETURNING id`,
            [patient1UserId]
        );
        patient1Id = pat1Res.rows[0].id;

        patient1Token = jwt.sign(
            { userId: patient1UserId, email: patient1Email, role: "PATIENT" },
            jwtSecret,
            { expiresIn: "2h" }
        );

        // 6. Patient 2
        const pat2UserRes = await pool.query(
            `INSERT INTO "users" (name, email, password, role)
             VALUES ($1, $2, $3, 'PATIENT')
             RETURNING id`,
            ["Bob Patient", patient2Email, hashedPassword]
        );
        patient2UserId = pat2UserRes.rows[0].id;

        const pat2Res = await pool.query(
            `INSERT INTO "patient_profiles" (owner_user_id, name, date_of_birth, gender, mobile_number)
             VALUES ($1, 'Bob Patient', '1985-08-20', 'Male', '555-0202')
             RETURNING id`,
            [patient2UserId]
        );
        patient2Id = pat2Res.rows[0].id;

        patient2Token = jwt.sign(
            { userId: patient2UserId, email: patient2Email, role: "PATIENT" },
            jwtSecret,
            { expiresIn: "2h" }
        );
    }, 30000);

    afterAll(async () => {
        // Cleanup appointments
        if (createdAppointmentIds.length > 0) {
            await pool.query('DELETE FROM "appointments" WHERE id = ANY($1)', [createdAppointmentIds]);
        }
        // Cleanup prescriptions and dispenses
        if (createdPrescriptionIds.length > 0) {
            await pool.query('DELETE FROM "pharmacy_dispenses" WHERE prescription_id = ANY($1)', [createdPrescriptionIds]);
            await pool.query('DELETE FROM "prescriptions" WHERE id = ANY($1)', [createdPrescriptionIds]);
        }
        // Cleanup lab orders
        if (createdLabOrderIds.length > 0) {
            await pool.query('DELETE FROM "investigation_orders" WHERE id = ANY($1)', [createdLabOrderIds]);
        }
        // Cleanup workflow tasks
        if (createdTaskIds.length > 0) {
            await pool.query('DELETE FROM "workflow_task_dependencies" WHERE task_id = ANY($1) OR depends_on_task_id = ANY($1)', [createdTaskIds]);
            await pool.query('DELETE FROM "workflow_tasks" WHERE id = ANY($1)', [createdTaskIds]);
        }
        // Cleanup queue entries and visits
        if (createdVisitIds.length > 0) {
            await pool.query('DELETE FROM "queue_entries" WHERE visit_id = ANY($1)', [createdVisitIds]);
            await pool.query('DELETE FROM "visits" WHERE id = ANY($1)', [createdVisitIds]);
        }
        if (createdQueueEntryIds.length > 0) {
            await pool.query('DELETE FROM "queue_entries" WHERE id = ANY($1)', [createdQueueEntryIds]);
        }

        // Cleanup users and profiles
        const uids = [staffUserId, doctorUserId, pharmacistUserId, patient1UserId, patient2UserId].filter(Boolean);
        if (uids.length > 0) {
            await pool.query('DELETE FROM "doctors" WHERE id = $1', [doctorId]);
            await pool.query('DELETE FROM "staff_profiles" WHERE id IN ($1, $2)', [doctorStaffId, pharmacistStaffId]);
            await pool.query('DELETE FROM "patient_profiles" WHERE id IN ($1, $2)', [patient1Id, patient2Id]);
            await pool.query('DELETE FROM "users" WHERE id = ANY($1)', [uids]);
        }

        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    }, 30000);

    // =========================================================================
    // FEATURE 1: APPOINTMENTS CONFLICT PROTECTION & OVERLAP PREVENTION
    // =========================================================================
    describe("Feature 1: Appointments Conflict Protection & Overlap Prevention", () => {
        let firstAppointmentId: string;
        const testDate = "2026-11-20";
        const startTime1 = `${testDate}T10:00:00.000Z`;
        const endTime1 = `${testDate}T10:20:00.000Z`;

        it("1. Books an initial appointment successfully when no conflicts exist", async () => {
            const res = await fetch(`${baseUrl}/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${patient1Token}`,
                },
                body: JSON.stringify({
                    patientId: patient1Id,
                    doctorId: doctorId,
                    startTime: startTime1,
                    endTime: endTime1,
                    type: "CONSULTATION",
                }),
            });

            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.id).toBeDefined();
            expect(data.status).toBe("SCHEDULED");
            expect(data.doctor_name).toContain("Sarah");
            firstAppointmentId = data.id;
            createdAppointmentIds.push(data.id);
        });

        it("2. Blocks conflicting appointment booking for the SAME doctor during the overlapping window (returns 409 Conflict)", async () => {
            // Patient 2 attempts to book the same doctor during 10:10 to 10:30 (overlaps with 10:00 - 10:20)
            const overlapStart = `${testDate}T10:10:00.000Z`;
            const overlapEnd = `${testDate}T10:30:00.000Z`;

            const res = await fetch(`${baseUrl}/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${patient2Token}`,
                },
                body: JSON.stringify({
                    patientId: patient2Id,
                    doctorId: doctorId,
                    startTime: overlapStart,
                    endTime: overlapEnd,
                }),
            });

            expect(res.status).toBe(409);
            const err = await res.json();
            expect(err.message).toMatch(/Doctor conflict.*already booked/i);
        });

        it("3. Blocks conflicting appointment booking for the SAME patient across doctors during overlapping window (returns 409 Conflict)", async () => {
            // Patient 1 attempts to book another doctor (or same) overlapping with their 10:00 - 10:20 slot
            const overlapStart = `${testDate}T10:05:00.000Z`;
            const overlapEnd = `${testDate}T10:25:00.000Z`;

            const res = await fetch(`${baseUrl}/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${patient1Token}`,
                },
                body: JSON.stringify({
                    patientId: patient1Id,
                    doctorId: doctorId,
                    startTime: overlapStart,
                    endTime: overlapEnd,
                }),
            });

            expect(res.status).toBe(409);
            const err = await res.json();
            expect(err.message).toMatch(/conflict/i);
        });

        it("4. Allows booking a non-overlapping adjacent time slot for the doctor", async () => {
            // Right after first appointment: 10:20 - 10:40
            const nextStart = `${testDate}T10:20:00.000Z`;
            const nextEnd = `${testDate}T10:40:00.000Z`;

            const res = await fetch(`${baseUrl}/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${patient2Token}`,
                },
                body: JSON.stringify({
                    patientId: patient2Id,
                    doctorId: doctorId,
                    startTime: nextStart,
                    endTime: nextEnd,
                }),
            });

            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.id).toBeDefined();
            createdAppointmentIds.push(data.id);
        });
    });

    // =========================================================================
    // FEATURE 2: DYNAMIC SLOT AVAILABILITY CALCULATION
    // =========================================================================
    describe("Feature 2: Dynamic Slot Availability Calculation", () => {
        const testDate = "2026-11-20";

        it("1. Returns generated slots based on doctor's 20-minute consultation_minutes", async () => {
            const res = await fetch(
                `${baseUrl}/appointments/availability?doctorId=${doctorId}&date=${testDate}`
            );

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.doctorId).toBe(doctorId);
            expect(data.consultationMinutes).toBe(20);
            expect(Array.isArray(data.slots)).toBe(true);
            expect(data.totalSlots).toBeGreaterThan(0);

            // 09:00 to 17:00 is 8 hours = 480 mins / 20 mins = 24 slots
            expect(data.totalSlots).toBe(24);
        });

        it("2. Correctly flags booked slots as available: false and non-booked slots as available: true", async () => {
            const res = await fetch(
                `${baseUrl}/appointments/availability?doctorId=${doctorId}&date=${testDate}`
            );

            expect(res.status).toBe(200);
            const data = await res.json();

            // Slot 10:00 - 10:20 was booked in Feature 1
            const slot1000 = data.slots.find((s: { timeLabel: string }) => s.timeLabel === "10:00 - 10:20");
            expect(slot1000).toBeDefined();
            expect(slot1000.available).toBe(false);
            expect(slot1000.reason).toBe("Booked");

            // Slot 10:20 - 10:40 was booked in Feature 1
            const slot1020 = data.slots.find((s: { timeLabel: string }) => s.timeLabel === "10:20 - 10:40");
            expect(slot1020).toBeDefined();
            expect(slot1020.available).toBe(false);

            // Slot 09:00 - 09:20 is unbooked
            const slot0900 = data.slots.find((s: { timeLabel: string }) => s.timeLabel === "09:00 - 09:20");
            expect(slot0900).toBeDefined();
            expect(slot0900.available).toBe(true);

            expect(data.availableSlots).toBe(data.totalSlots - 2);
        });

        it("3. Works also through doctor resource endpoint GET /doctors/:doctorId/availability", async () => {
            const res = await fetch(
                `${baseUrl}/doctors/${doctorId}/availability?date=${testDate}`
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.doctorId).toBe(doctorId);
            expect(data.slots.length).toBe(24);
        });
    });

    // =========================================================================
    // FEATURE 3: AUTOMATED CHECK-IN → VISIT CONVERSION
    // =========================================================================
    describe("Feature 3: Automated Check-in → Visit Conversion", () => {
        let apptToCheckInId: string;

        beforeAll(async () => {
            const res = await fetch(`${baseUrl}/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${patient1Token}`,
                },
                body: JSON.stringify({
                    patientId: patient1Id,
                    doctorId: doctorId,
                    startTime: "2026-11-25T14:00:00.000Z",
                    endTime: "2026-11-25T14:20:00.000Z",
                }),
            });
            const data = await res.json();
            apptToCheckInId = data.id;
            createdAppointmentIds.push(data.id);
        });

        it("1. POST /appointments/:id/check-in atomically transitions status to CHECKED_IN, creates linked visit, and enqueues in queue", async () => {
            const res = await fetch(`${baseUrl}/appointments/${apptToCheckInId}/check-in`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            // Appointment updated
            expect(data.appointment.id).toBe(apptToCheckInId);
            expect(data.appointment.status).toBe("CHECKED_IN");

            // Visit created
            expect(data.visit).toBeDefined();
            expect(data.visit.patient_id).toBe(patient1Id);
            expect(data.visit.appointment_id).toBe(apptToCheckInId);
            expect(data.visit.status).toBe("WAITING_OPD");
            createdVisitIds.push(data.visit.id);

            // Queue entry created
            expect(data.queueEntry).toBeDefined();
            expect(data.queueEntry.queue_type).toBe("APPOINTMENT");
            expect(data.queueEntry.status).toBe("WAITING");
            expect(typeof data.position).toBe("number");
            createdQueueEntryIds.push(data.queueEntry.id);
        });

        it("2. Repeated check-in on already checked-in appointment is idempotent and returns existing linked records", async () => {
            const res = await fetch(`${baseUrl}/appointments/${apptToCheckInId}/check-in`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${staffToken}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.appointment.status).toBe("CHECKED_IN");
            expect(data.visit.appointment_id).toBe(apptToCheckInId);
        });
    });

    // =========================================================================
    // FEATURE 4: LAB SAMPLE COLLECTION TRACKING & REPORT FILE UPLOAD
    // =========================================================================
    describe("Feature 4: Lab Sample Collection Tracking & Report File Upload", () => {
        let visitId: string;
        let labOrderId: string;

        beforeAll(async () => {
            // Create walk-in visit for lab testing
            const vRes = await pool.query(
                `INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status)
                 VALUES ($1, $2, 'WALKIN', 'DIAGNOSTICS')
                 RETURNING id`,
                [patient1Id, doctorId]
            );
            visitId = vRes.rows[0].id;
            createdVisitIds.push(visitId);

            // Create lab order
            const orderRes = await fetch(`${baseUrl}/lab-orders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    patientId: patient1Id,
                    visitId: visitId,
                    doctorId: doctorId,
                    testName: "Complete Blood Count (CBC)",
                    instructions: "Fasting 8 hours",
                }),
            });
            const orderData = await orderRes.json();
            labOrderId = orderData.id;
            createdLabOrderIds.push(labOrderId);
        });

        it("1. Tracks sample collection via POST /lab-orders/:id/sample (transitions to SAMPLE_COLLECTED)", async () => {
            const res = await fetch(`${baseUrl}/lab-orders/${labOrderId}/sample`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    sampleType: "Blood - EDTA Tube",
                    notes: "Venipuncture right arm, 5mL tube",
                }),
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.id).toBe(labOrderId);
            expect(data.status).toBe("SAMPLE_COLLECTED");
            expect(data.sample_collected_at).toBeDefined();
        });

        it("2. Uploads report file URL via POST /lab-orders/:id/report (transitions to COMPLETED and stores report_url)", async () => {
            const reportUrl = "https://hospital-reports.storage.internal/cbc_result_pat1_20261120.pdf";
            const res = await fetch(`${baseUrl}/lab-orders/${labOrderId}/report`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    reportUrl,
                    result: "WBC: 6.8 x10^9/L (Normal), RBC: 4.5 x10^12/L (Normal), Hemoglobin: 14.2 g/dL (Normal)",
                    notes: "All parameters within normal physiological reference ranges",
                }),
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.id).toBe(labOrderId);
            expect(data.status).toBe("COMPLETED");
            expect(data.report_url).toBe(reportUrl);
            expect(data.result).toContain("WBC");
        });

        it("3. GET /lab-orders/:id returns the completed order with report_url and timestamps intact", async () => {
            const res = await fetch(`${baseUrl}/lab-orders/${labOrderId}`, {
                headers: {
                    Authorization: `Bearer ${patient1Token}`,
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.id).toBe(labOrderId);
            expect(data.status).toBe("COMPLETED");
            expect(data.report_url).toContain("cbc_result");
            expect(data.sample_collected_at).toBeDefined();
            expect(data.resulted_at).toBeDefined();
        });
    });

    // =========================================================================
    // FEATURE 5: PHARMACY DEPENDENCY GATING ON LAB COMPLETION BEFORE DISPENSING
    // =========================================================================
    describe("Feature 5: Pharmacy Dependency Gating on Lab Completion", () => {
        let visitId: string;
        let pendingLabOrderId: string;
        let prescriptionId: string;

        beforeAll(async () => {
            // Create a visit that has both a lab test and a prescription
            const vRes = await pool.query(
                `INSERT INTO "visits" (patient_id, assigned_doctor_id, visit_type, status)
                 VALUES ($1, $2, 'WALKIN', 'DIAGNOSTICS')
                 RETURNING id`,
                [patient2Id, doctorId]
            );
            visitId = vRes.rows[0].id;
            createdVisitIds.push(visitId);

            // 1. Create a pending lab test for this visit
            const labRes = await pool.query(
                `INSERT INTO "investigation_orders" (visit_id, doctor_id, test_name, status)
                 VALUES ($1, $2, 'Renal Function Panel', 'PENDING')
                 RETURNING id`,
                [visitId, doctorId]
            );
            pendingLabOrderId = labRes.rows[0].id;
            createdLabOrderIds.push(pendingLabOrderId);

            // 2. Create prescription for this visit
            const prescRes = await pool.query(
                `INSERT INTO "prescriptions" (visit_id, doctor_id, medication, dosage, status)
                 VALUES ($1, $2, 'Ceftriaxone 1g IV', '1g daily', 'PENDING')
                 RETURNING id`,
                [visitId, doctorId]
            );
            prescriptionId = prescRes.rows[0].id;
            createdPrescriptionIds.push(prescriptionId);
        });

        it("1. Blocks medication dispensing when visit has uncompleted lab investigations (returns 400 Bad Request)", async () => {
            const res = await fetch(`${baseUrl}/prescriptions/${prescriptionId}/dispense`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${pharmacistToken}`,
                },
                body: JSON.stringify({
                    quantity: 1,
                    notes: "Pharmacist standard dispense attempt",
                }),
            });

            expect(res.status).toBe(400);
            const err = await res.json();
            expect(err.message).toMatch(/Cannot dispense medication.*pending lab investigation.*completed first/i);
            expect(err.message).toContain("Renal Function Panel");
        });

        it("2. Allows dispensing after the pending lab investigation is marked COMPLETED", async () => {
            // Lab tech completes the pending test with report
            const labCompleteRes = await fetch(`${baseUrl}/lab-orders/${pendingLabOrderId}/report`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`,
                },
                body: JSON.stringify({
                    reportUrl: "https://hospital-reports.storage.internal/renal_panel_pat2.pdf",
                    result: "BUN: 12 mg/dL, Creatinine: 0.9 mg/dL - Normal kidney function",
                }),
            });
            expect(labCompleteRes.status).toBe(200);

            // Pharmacist retries dispensing — now succeeds!
            const res = await fetch(`${baseUrl}/prescriptions/${prescriptionId}/dispense`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${pharmacistToken}`,
                },
                body: JSON.stringify({
                    quantity: 1,
                    notes: "Renal panel verified normal; medication dispensed safely",
                }),
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.prescription.status).toBe("DISPENSED");
            expect(data.dispense).toBeDefined();
            expect(data.dispense.dispensed_quantity).toBe(1);
        });
    });
});
