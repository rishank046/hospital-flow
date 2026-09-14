import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "#app";
import pool from "#database/pool.js";
import schema from "#database/projectSchema.js";

describe("Visit Lifecycle - End-to-End Flow", () => {
    let server: http.Server;
    let baseUrl: string;
    const jwtSecret = process.env.JWT_SECRET!;
    const testTag = Date.now();

    // Admin
    const adminEmail = `admin_lifecycle_${testTag}@example.com`;
    const adminPassword = "AdminPassword123!";
    let adminToken: string;
    let adminId: string;

    // Staff members
    let receptionistToken: string;
    let nurseToken: string;
    let doctorToken: string;
    let pharmacistToken: string;
    let labTechToken: string;

    let doctorId: string;
    let doctorStaffId: string;
    let doctorUserId: string;

    const receptionistEmail = `receptionist_${testTag}@example.com`;
    const nurseEmail = `nurse_${testTag}@example.com`;
    const doctorEmail = `doctor_${testTag}@example.com`;
    const pharmacistEmail = `pharmacist_${testTag}@example.com`;
    const labTechEmail = `labtech_${testTag}@example.com`;

    let receptionistTempPass: string;
    let nurseTempPass: string;
    let doctorTempPass: string;
    let pharmacistTempPass: string;
    let labTechTempPass: string;

    // Lifecycle state
    let patientId: string;
    let visitId: string;
    let queueEntryId: string;
    let consultationId: string;
    let prescriptionId: string;
    let labOrderId: string;
    let invoiceId: string;

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
            ["Lifecycle Admin", adminEmail, hashedAdminPassword]
        );
        adminId = adminRes.rows[0].id;
        adminToken = jwt.sign(
            { userId: adminId, email: adminEmail, role: "ADMIN" },
            jwtSecret,
            { expiresIn: "4h" }
        );

        // Seed a Walk-in Patient record
        const patRes = await pool.query(
            `INSERT INTO "patient_profiles" (name, date_of_birth, gender)
             VALUES ('Alex Lifecycle', '1997-01-01', 'Male')
             RETURNING id`
        );
        patientId = patRes.rows[0].id;
    });

    afterAll(async () => {
        // Cleanup created data
        if (visitId) {
            await pool.query('DELETE FROM "invoice_items" WHERE invoice_id IN (SELECT id FROM "invoices" WHERE visit_id = $1)', [visitId]);
            await pool.query('DELETE FROM "invoices" WHERE visit_id = $1', [visitId]);
            await pool.query('DELETE FROM "pharmacy_dispenses" WHERE prescription_id IN (SELECT id FROM "prescriptions" WHERE visit_id = $1)', [visitId]);
            await pool.query('DELETE FROM "prescriptions" WHERE visit_id = $1', [visitId]);
            await pool.query('DELETE FROM "investigation_orders" WHERE visit_id = $1', [visitId]);
            await pool.query('DELETE FROM "consultations" WHERE visit_id = $1', [visitId]);
            await pool.query('DELETE FROM "queue_entries" WHERE visit_id = $1', [visitId]);
            await pool.query('DELETE FROM "vitals" WHERE visit_id = $1', [visitId]);
            await pool.query('DELETE FROM "visits" WHERE id = $1', [visitId]);
        }
        if (patientId) {
            await pool.query('DELETE FROM "patient_profiles" WHERE id = $1', [patientId]);
        }
        if (adminId) {
            await pool.query('DELETE FROM "users" WHERE id = $1', [adminId]);
        }

        const emails = [receptionistEmail, nurseEmail, doctorEmail, pharmacistEmail, labTechEmail];
        await pool.query('DELETE FROM "doctors" WHERE staff_id IN (SELECT id FROM "staff_profiles" WHERE user_id IN (SELECT id FROM "users" WHERE email = ANY($1)))', [emails]);
        await pool.query('DELETE FROM "staff_profiles" WHERE user_id IN (SELECT id FROM "users" WHERE email = ANY($1))', [emails]);
        await pool.query('DELETE FROM "users" WHERE email = ANY($1)', [emails]);

        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        await pool.end();
    });

    it("1. Admin creates staff accounts (receptionist, nurse, doctor, pharmacist, lab tech) via POST /admin/staff", { timeout: 15000 }, async () => {
        // 1a. Receptionist
        const recRes = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Rachel Receptionist",
                email: receptionistEmail,
                role: "RECEPTIONIST",
                department: "Front Desk",
            }),
        });
        expect(recRes.status).toBe(201);
        const recData = await recRes.json();
        expect(recData.temporaryPassword).toBeTruthy();
        expect(recData.staff.role).toBe("RECEPTIONIST");
        receptionistTempPass = recData.temporaryPassword;

        // 1b. Nurse
        const nurseRes = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Nancy Nurse",
                email: nurseEmail,
                role: "NURSE",
                department: "Triage",
            }),
        });
        expect(nurseRes.status).toBe(201);
        const nurseData = await nurseRes.json();
        expect(nurseData.temporaryPassword).toBeTruthy();
        expect(nurseData.staff.role).toBe("NURSE");
        nurseTempPass = nurseData.temporaryPassword;

        // 1c. Doctor
        const docRes = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Dr. David Doctor",
                email: doctorEmail,
                role: "DOCTOR",
                department: "Cardiology",
                specialization: "Cardiology",
                licenseNumber: `MED-${testTag}`,
            }),
        });
        expect(docRes.status).toBe(201);
        const docData = await docRes.json();
        expect(docData.temporaryPassword).toBeTruthy();
        expect(docData.staff.role).toBe("DOCTOR");
        expect(docData.doctor).toBeDefined();
        expect(docData.doctor.id).toBeTruthy();
        doctorId = docData.doctor.id;
        doctorStaffId = docData.staff.id;
        doctorUserId = docData.user.id;
        doctorTempPass = docData.temporaryPassword;

        // 1d. Pharmacist
        const pharmRes = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Philip Pharmacist",
                email: pharmacistEmail,
                role: "PHARMACIST",
                department: "Pharmacy",
            }),
        });
        expect(pharmRes.status).toBe(201);
        const pharmData = await pharmRes.json();
        expect(pharmData.temporaryPassword).toBeTruthy();
        expect(pharmData.staff.role).toBe("PHARMACIST");
        pharmacistTempPass = pharmData.temporaryPassword;

        // 1e. Lab Tech
        const labRes = await fetch(`${baseUrl}/admin/staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                name: "Larry LabTech",
                email: labTechEmail,
                role: "LAB_TECH",
                department: "Diagnostic Laboratory",
            }),
        });
        expect(labRes.status).toBe(201);
        const labData = await labRes.json();
        expect(labData.temporaryPassword).toBeTruthy();
        expect(labData.staff.role).toBe("LAB_TECH");
        labTechTempPass = labData.temporaryPassword;
    });

    it("2. Each staff member logs in via POST /auth/login and receives JWT with correct role & staffRole", async () => {
        // Receptionist Login
        const recLogin = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: receptionistEmail, password: receptionistTempPass }),
        });
        expect(recLogin.status).toBe(200);
        const recJson = await recLogin.json();
        expect(recJson.token).toBeTruthy();
        expect(recJson.user.role).toBe("STAFF");
        expect(recJson.user.staffRole).toBe("RECEPTIONIST");
        receptionistToken = recJson.token;

        const recDecoded = jwt.decode(receptionistToken) as any;
        expect(recDecoded.role).toBe("STAFF");
        expect(recDecoded.staffRole).toBe("RECEPTIONIST");

        // Nurse Login
        const nurseLogin = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: nurseEmail, password: nurseTempPass }),
        });
        expect(nurseLogin.status).toBe(200);
        const nurseJson = await nurseLogin.json();
        expect(nurseJson.token).toBeTruthy();
        expect(nurseJson.user.role).toBe("STAFF");
        expect(nurseJson.user.staffRole).toBe("NURSE");
        nurseToken = nurseJson.token;

        const nurseDecoded = jwt.decode(nurseToken) as any;
        expect(nurseDecoded.role).toBe("STAFF");
        expect(nurseDecoded.staffRole).toBe("NURSE");

        // Doctor Login
        const docLogin = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: doctorEmail, password: doctorTempPass }),
        });
        expect(docLogin.status).toBe(200);
        const docJson = await docLogin.json();
        expect(docJson.token).toBeTruthy();
        expect(docJson.user.role).toBe("STAFF");
        expect(docJson.user.staffRole).toBe("DOCTOR");
        doctorToken = docJson.token;

        const docDecoded = jwt.decode(doctorToken) as any;
        expect(docDecoded.role).toBe("STAFF");
        expect(docDecoded.staffRole).toBe("DOCTOR");

        // Pharmacist Login
        const pharmLogin = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pharmacistEmail, password: pharmacistTempPass }),
        });
        expect(pharmLogin.status).toBe(200);
        const pharmJson = await pharmLogin.json();
        expect(pharmJson.token).toBeTruthy();
        expect(pharmJson.user.role).toBe("STAFF");
        expect(pharmJson.user.staffRole).toBe("PHARMACIST");
        pharmacistToken = pharmJson.token;

        const pharmDecoded = jwt.decode(pharmacistToken) as any;
        expect(pharmDecoded.role).toBe("STAFF");
        expect(pharmDecoded.staffRole).toBe("PHARMACIST");

        // Lab Tech Login
        const labLogin = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: labTechEmail, password: labTechTempPass }),
        });
        expect(labLogin.status).toBe(200);
        const labJson = await labLogin.json();
        expect(labJson.token).toBeTruthy();
        expect(labJson.user.role).toBe("STAFF");
        expect(labJson.user.staffRole).toBe("LAB_TECH");
        labTechToken = labJson.token;

        const labDecoded = jwt.decode(labTechToken) as any;
        expect(labDecoded.role).toBe("STAFF");
        expect(labDecoded.staffRole).toBe("LAB_TECH");
    });

    it("3. Receptionist creates a visit (POST /visits) for walk-in patient -> status = REGISTERED", async () => {
        const res = await fetch(`${baseUrl}/visits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${receptionistToken}`,
            },
            body: JSON.stringify({
                patientId,
                visitType: "WALKIN",
                assignedDoctorId: doctorId,
            }),
        });

        expect(res.status).toBe(201);
        const visit = await res.json();
        expect(visit.id).toBeTruthy();
        expect(visit.patientId || visit.patient_id).toBe(patientId);
        expect(visit.status).toBe("REGISTERED");
        expect(visit.visitType || visit.visit_type).toBe("WALKIN");
        visitId = visit.id;
    });

    it("4. Nurse records vitals (POST /visits/:visitId/vitals) -> visit status flips to VITALS", async () => {
        const res = await fetch(`${baseUrl}/visits/${visitId}/vitals`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${nurseToken}`,
            },
            body: JSON.stringify({
                temperature: 36.9,
                heartRate: 74,
                bloodPressure: "120/80",
                respiratoryRate: 16,
                oxygenSaturation: 99,
                weight: 72,
                height: 178,
                notes: "Normal vitals recorded at triage",
            }),
        });

        expect(res.status).toBe(201);
        const vitals = await res.json();
        expect(vitals.visit_id).toBe(visitId);
        expect(vitals.temperature).toBe("36.9");
        expect(vitals.heart_rate).toBe(74);

        // Verify visit status flipped to VITALS
        const visitRes = await fetch(`${baseUrl}/visits/${visitId}`, {
            headers: { Authorization: `Bearer ${nurseToken}` },
        });
        expect(visitRes.status).toBe(200);
        const visit = await visitRes.json();
        expect(visit.status).toBe("VITALS");
    });

    it("5. Receptionist joins OPD queue (POST /queue/join) -> visit status flips to WAITING_OPD & queue entry is WAITING", async () => {
        const res = await fetch(`${baseUrl}/queue/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${receptionistToken}`,
            },
            body: JSON.stringify({
                visitId,
                doctorId,
                priority: 1,
                type: "WALK_IN",
            }),
        });

        expect(res.status).toBe(201);
        const entry = await res.json();
        expect(entry.id).toBeTruthy();
        expect(entry.visit_id || entry.visitId).toBe(visitId);
        expect(entry.status).toBe("WAITING");
        queueEntryId = entry.id;

        // Verify visit status flipped to WAITING_OPD
        const visitRes = await fetch(`${baseUrl}/visits/${visitId}`, {
            headers: { Authorization: `Bearer ${receptionistToken}` },
        });
        expect(visitRes.status).toBe(200);
        const visit = await visitRes.json();
        expect(visit.status).toBe("WAITING_OPD");
    });

    it("6. Doctor calls next (POST /queue/doctor/call-next) -> entry status is CALLED for correct patient", async () => {
        const res = await fetch(`${baseUrl}/queue/doctor/call-next`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        const entry = json.next || json;
        expect(entry.id).toBe(queueEntryId);
        expect(entry.status).toBe("CALLED");
        expect(entry.patient_id).toBe(patientId);
        expect(entry.called_at).toBeTruthy();
    });

    it("7. Doctor starts serving (POST /queue/:id/start) -> queue entry IN_PROGRESS & visit status flips to IN_CONSULTATION", async () => {
        const res = await fetch(`${baseUrl}/queue/${queueEntryId}/start`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });

        expect(res.status).toBe(200);
        const entry = await res.json();
        expect(entry.id).toBe(queueEntryId);
        expect(entry.status).toBe("IN_PROGRESS");
        expect(entry.started_at).toBeTruthy();

        // Verify visit status is now IN_CONSULTATION
        const visitRes = await fetch(`${baseUrl}/visits/${visitId}`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        expect(visitRes.status).toBe(200);
        const visit = await visitRes.json();
        expect(visit.status).toBe("IN_CONSULTATION");
    });

    it("8. Doctor creates consultation with prescription and lab order -> both linked to visit_id", async () => {
        // 8a. Consultation with prescription
        const consultRes = await fetch(`${baseUrl}/doctors/patients/${patientId}/consultation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                visitId,
                diagnosis: "Acute Bronchial Infection",
                notes: "Persistent dry cough for 3 days",
                treatmentPlan: "Antibiotics regimen and chest imaging",
                prescriptions: [
                    {
                        medication: "Amoxicillin",
                        dosage: "500mg",
                        frequency: "TDS",
                        duration: "5 days",
                        instructions: "Take with food",
                    },
                ],
            }),
        });

        expect(consultRes.status).toBe(201);
        const consultData = await consultRes.json();
        expect(consultData.id).toBeTruthy();
        expect(consultData.visit_id).toBe(visitId);
        expect(consultData.diagnosis).toBe("Acute Bronchial Infection");
        consultationId = consultData.id;

        // Verify prescription row created and linked to visit_id
        const prescCheck = await pool.query(
            'SELECT * FROM "prescriptions" WHERE consultation_id = $1',
            [consultationId]
        );
        expect(prescCheck.rows.length).toBe(1);
        expect(prescCheck.rows[0].visit_id).toBe(visitId);
        expect(prescCheck.rows[0].medication).toBe("Amoxicillin");
        expect(prescCheck.rows[0].status).toBe("PENDING");
        prescriptionId = prescCheck.rows[0].id;

        // 8b. Investigation / Lab order
        const labRes = await fetch(`${baseUrl}/doctors/patients/${patientId}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${doctorToken}`,
            },
            body: JSON.stringify({
                visitId,
                testName: "Chest X-Ray PA View",
                instructions: "Examine bronchial infiltrates",
            }),
        });

        expect(labRes.status).toBe(201);
        const labData = await labRes.json();
        expect(labData.id).toBeTruthy();
        expect(labData.visit_id).toBe(visitId);
        expect(labData.test_name).toBe("Chest X-Ray PA View");
        expect(labData.status).toBe("PENDING");
        labOrderId = labData.id;
    });

    it("9. Doctor completes queue entry (POST /queue/:id/complete) -> queue COMPLETED; visit status not auto-completed", async () => {
        const res = await fetch(`${baseUrl}/queue/${queueEntryId}/complete`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${doctorToken}`,
            },
        });

        expect(res.status).toBe(200);
        const entry = await res.json();
        expect(entry.id).toBe(queueEntryId);
        expect(entry.status).toBe("COMPLETED");
        expect(entry.completed_at).toBeTruthy();

        // Verify visit status is NOT completed (still in care stream)
        const visitRes = await fetch(`${baseUrl}/visits/${visitId}`, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        expect(visitRes.status).toBe(200);
        const visit = await visitRes.json();
        expect(visit.status).not.toBe("COMPLETED");
        expect(visit.status).toBe("IN_CONSULTATION");
    });

    it("10. Lab tech updates lab order to COMPLETED with result (PATCH /lab-orders/:id)", async () => {
        const res = await fetch(`${baseUrl}/lab-orders/${labOrderId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${labTechToken}`,
            },
            body: JSON.stringify({
                status: "COMPLETED",
                result: "Clear lung fields, minimal bronchial thickening, no active consolidation.",
                instructions: "Routine follow-up recommended.",
            }),
        });

        expect(res.status).toBe(200);
        const updated = await res.json();
        expect(updated.id).toBe(labOrderId);
        expect(updated.status).toBe("COMPLETED");
        expect(updated.result).toContain("Clear lung fields");
    });

    it("11. Pharmacist dispenses prescription (PATCH /prescriptions/:id/dispense) -> DISPENSED & pharmacy_dispenses row exists", async () => {
        const res = await fetch(`${baseUrl}/prescriptions/${prescriptionId}/dispense`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${pharmacistToken}`,
            },
            body: JSON.stringify({
                quantity: 1,
                notes: "Dispensed 1 strip Amoxicillin 500mg (15 capsules) with meal instructions.",
            }),
        });

        expect(res.status).toBe(200);

        // Verify prescription row status
        const prescRes = await pool.query(
            'SELECT * FROM "prescriptions" WHERE id = $1',
            [prescriptionId]
        );
        expect(prescRes.rows.length).toBe(1);
        expect(prescRes.rows[0].status).toBe("DISPENSED");

        // Verify pharmacy_dispenses row
        const dispRes = await pool.query(
            'SELECT * FROM "pharmacy_dispenses" WHERE prescription_id = $1',
            [prescriptionId]
        );
        expect(dispRes.rows.length).toBe(1);
        expect(dispRes.rows[0].quantity || dispRes.rows[0].dispensed_quantity).toBeTruthy();
        expect(dispRes.rows[0].notes).toContain("Amoxicillin");
    });

    it("12. Billing invoice generated (POST /visits/:visitId/invoice) -> invoice_items reflects consultation + lab + medication", async () => {
        const res = await fetch(`${baseUrl}/visits/${visitId}/invoice`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${receptionistToken}`,
            },
        });

        expect(res.status).toBe(201);
        const invoiceData = await res.json();
        expect(invoiceData.id).toBeTruthy();
        expect(invoiceData.visit_id).toBe(visitId);
        expect(invoiceData.status).toBe("PENDING");
        invoiceId = invoiceData.id;

        // Query invoice_items table directly to verify all components are billed
        const itemsRes = await pool.query(
            'SELECT * FROM "invoice_items" WHERE invoice_id = $1 ORDER BY item_type ASC',
            [invoiceId]
        );
        expect(itemsRes.rows.length).toBeGreaterThanOrEqual(3);

        const itemTypes = itemsRes.rows.map((r) => r.item_type);
        expect(itemTypes).toContain("CONSULTATION");
        expect(itemTypes).toContain("INVESTIGATION");
        expect(itemTypes).toContain("MEDICATION");

        // Verify total price is sum of items
        const sumItems = itemsRes.rows.reduce((acc, curr) => acc + Number(curr.amount || curr.total_price), 0);
        expect(Number(invoiceData.amount)).toBeCloseTo(sumItems, 2);
    });

    it("13. Invoice paid (PATCH /invoices/:id/pay) -> invoice PAID & visit status flips to COMPLETED", async () => {
        const res = await fetch(`${baseUrl}/invoices/${invoiceId}/pay`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${receptionistToken}`,
            },
        });

        expect(res.status).toBe(200);
        const payData = await res.json();
        expect(payData.invoice.status).toBe("PAID");

        // Verify visit status flips to COMPLETED
        const visitRes = await fetch(`${baseUrl}/visits/${visitId}`, {
            headers: { Authorization: `Bearer ${receptionistToken}` },
        });
        expect(visitRes.status).toBe(200);
        const visit = await visitRes.json();
        expect(visit.status).toBe("COMPLETED");
    });

    it("14. Final integrity check: GET /visits/:id returns full chain with all linked entities consistent", async () => {
        const res = await fetch(`${baseUrl}/visits/${visitId}`, {
            headers: { Authorization: `Bearer ${receptionistToken}` },
        });

        expect(res.status).toBe(200);
        const fullVisit = await res.json();

        expect(fullVisit.id).toBe(visitId);
        expect(fullVisit.status).toBe("COMPLETED");

        // Vitals
        expect(fullVisit.vitals).toBeDefined();
        expect(fullVisit.vitals.length).toBeGreaterThanOrEqual(1);
        expect(fullVisit.vitals[0].visit_id).toBe(visitId);
        expect(fullVisit.vitals[0].heart_rate).toBe(74);

        // Queue entries
        expect(fullVisit.queue_entries).toBeDefined();
        expect(fullVisit.queue_entries.length).toBeGreaterThanOrEqual(1);
        expect(fullVisit.queue_entries[0].visit_id).toBe(visitId);
        expect(fullVisit.queue_entries[0].status).toBe("COMPLETED");

        // Consultations
        expect(fullVisit.consultations).toBeDefined();
        expect(fullVisit.consultations.length).toBeGreaterThanOrEqual(1);
        expect(fullVisit.consultations[0].id).toBe(consultationId);
        expect(fullVisit.consultations[0].diagnosis).toBe("Acute Bronchial Infection");

        // Prescriptions
        expect(fullVisit.prescriptions).toBeDefined();
        expect(fullVisit.prescriptions.length).toBeGreaterThanOrEqual(1);
        expect(fullVisit.prescriptions[0].id).toBe(prescriptionId);
        expect(fullVisit.prescriptions[0].medication).toBe("Amoxicillin");
        expect(fullVisit.prescriptions[0].status).toBe("DISPENSED");

        // Investigation orders
        expect(fullVisit.investigation_orders).toBeDefined();
        expect(fullVisit.investigation_orders.length).toBeGreaterThanOrEqual(1);
        expect(fullVisit.investigation_orders[0].id).toBe(labOrderId);
        expect(fullVisit.investigation_orders[0].test_name).toBe("Chest X-Ray PA View");
        expect(fullVisit.investigation_orders[0].status).toBe("COMPLETED");

        // Invoices
        expect(fullVisit.invoices).toBeDefined();
        expect(fullVisit.invoices.length).toBeGreaterThanOrEqual(1);
        expect(fullVisit.invoices[0].id).toBe(invoiceId);
        expect(fullVisit.invoices[0].status).toBe("PAID");
    });
});
