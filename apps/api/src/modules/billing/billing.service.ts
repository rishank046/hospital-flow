import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { updateVisitStatusService } from "#modules/visits/visits.service.js";
import type { GenerateInvoiceInput, PayInvoiceInput } from "./billing.schema.js";

interface DerivedItem {
    description: string;
    item_type: "CONSULTATION" | "TEST" | "INVESTIGATION" | "MEDICATION" | "OTHER";
    quantity: number;
    unit_price: number;
    total_price: number;
}

export async function generateInvoiceService(
    visitId: string,
    data?: GenerateInvoiceInput,
    authUser?: AuthPayload
) {
    const visitRes = await pool.query<{ id: string; patient_id: string; status: string }>(
        'SELECT id, patient_id, status FROM "visits" WHERE id = $1',
        [visitId]
    );

    if (visitRes.rowCount === 0 || !visitRes.rows[0]) {
        throw new AppError("Visit not found", 404);
    }

    const visit = visitRes.rows[0];
    const derivedItems: DerivedItem[] = [];

    // 1. Consultations
    const consultsRes = await pool.query(
        'SELECT * FROM "consultations" WHERE visit_id = $1',
        [visitId]
    );
    for (const c of consultsRes.rows) {
        derivedItems.push({
            description: `Doctor Consultation (${c.diagnosis})`,
            item_type: "CONSULTATION",
            quantity: 1,
            unit_price: 50.0,
            total_price: 50.0,
        });
    }

    // 2. Investigation Orders
    const testsRes = await pool.query(
        'SELECT * FROM "investigation_orders" WHERE visit_id = $1',
        [visitId]
    );
    for (const t of testsRes.rows) {
        derivedItems.push({
            description: `Diagnostic Test: ${t.test_name}`,
            item_type: "INVESTIGATION",
            quantity: 1,
            unit_price: 35.0,
            total_price: 35.0,
        });
    }

    // 3. Dispensed Medications
    const prescRes = await pool.query(
        `SELECT pr.*, pd.quantity as dispensed_qty
         FROM "prescriptions" pr
         LEFT JOIN "pharmacy_dispenses" pd ON pd.prescription_id = pr.id
         WHERE pr.visit_id = $1
           AND (pr.status = 'DISPENSED' OR pd.id IS NOT NULL)`,
        [visitId]
    );
    for (const p of prescRes.rows) {
        const qty = Number(p.dispensed_qty) || 1;
        derivedItems.push({
            description: `Medication: ${p.medication} (${p.dosage})`,
            item_type: "MEDICATION",
            quantity: qty,
            unit_price: 15.0,
            total_price: qty * 15.0,
        });
    }

    // 4. Custom items passed in request body
    if (data?.items && data.items.length > 0) {
        for (const item of data.items) {
            const qty = item.quantity ?? 1;
            const price = item.unitPrice ?? item.unit_price ?? 20.0;
            const rawType = (item.itemType || item.item_type || "OTHER").toUpperCase();
            let mappedType: "CONSULTATION" | "TEST" | "MEDICATION" | "OTHER" = "OTHER";
            if (rawType === "CONSULTATION") mappedType = "CONSULTATION";
            else if (rawType === "TEST" || rawType === "INVESTIGATION") mappedType = "TEST";
            else if (rawType === "MEDICATION") mappedType = "MEDICATION";

            derivedItems.push({
                description: item.description,
                item_type: mappedType,
                quantity: qty,
                unit_price: price,
                total_price: qty * price,
            });
        }
    }

    // 5. Fallback if no items
    if (derivedItems.length === 0) {
        derivedItems.push({
            description: "General Outpatient Consultation",
            item_type: "CONSULTATION",
            quantity: 1,
            unit_price: 50.0,
            total_price: 50.0,
        });
    }

    const totalAmount = derivedItems.reduce((acc, curr) => acc + curr.total_price, 0);

    // Resolve generated_by to staff_profiles.id
    let generatedByStaffId: string | null = null;
    if (authUser?.userId) {
        const staffLookup = await pool.query<{ id: string }>(
            'SELECT id FROM "staff_profiles" WHERE user_id = $1 OR id = $1',
            [authUser.userId]
        );
        if (staffLookup.rowCount && staffLookup.rows[0]) {
            generatedByStaffId = staffLookup.rows[0].id;
        }
    }

    // Create invoice record
    const invoiceRes = await pool.query(
        `INSERT INTO "invoices" (
            visit_id,
            patient_id,
            generated_by,
            total_amount,
            status
         )
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING *`,
        [
            visitId,
            visit.patient_id,
            generatedByStaffId,
            totalAmount,
        ]
    );

    const invoice = invoiceRes.rows[0];

    // Insert into invoice_items table
    const createdItems: unknown[] = [];
    for (const item of derivedItems) {
        const itemRes = await pool.query(
            `INSERT INTO "invoice_items" (
                invoice_id,
                description,
                item_type,
                amount
             )
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                invoice.id,
                item.description,
                item.item_type,
                item.total_price,
            ]
        );
        createdItems.push({
            ...itemRes.rows[0],
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
        });
    }

    // Advance visit status to BILLING if prior
    if (visit.status !== "BILLING" && visit.status !== "COMPLETED") {
        const transitionAuth: AuthPayload = {
            userId: authUser?.userId || "system",
            email: authUser?.email || "system@hospital.internal",
            role: "STAFF",
            staffRole: (authUser?.staffRole as any) || "BILLING_CLERK",
        };

        if (visit.status === "REGISTERED") {
            await updateVisitStatusService(visitId, "VITALS", transitionAuth);
            await updateVisitStatusService(visitId, "WAITING_OPD", transitionAuth);
            await updateVisitStatusService(visitId, "BILLING", transitionAuth);
        } else if (visit.status === "VITALS") {
            await updateVisitStatusService(visitId, "WAITING_OPD", transitionAuth);
            await updateVisitStatusService(visitId, "BILLING", transitionAuth);
        } else if (visit.status === "WAITING_OPD" || visit.status === "IN_CONSULTATION") {
            await updateVisitStatusService(visitId, "BILLING", transitionAuth);
        } else if (visit.status === "DIAGNOSTICS" || visit.status === "PHARMACY") {
            await updateVisitStatusService(visitId, "BILLING", transitionAuth);
        }
    }

    return {
        ...invoice,
        amount: invoice.total_amount,
        items: createdItems,
        invoice_items: createdItems,
        invoiceItems: createdItems,
    };
}

export async function payInvoiceService(
    invoiceId: string,
    data?: PayInvoiceInput,
    authUser?: AuthPayload
) {
    const invRes = await pool.query(
        'SELECT * FROM "invoices" WHERE id = $1',
        [invoiceId]
    );

    if (invRes.rowCount === 0 || !invRes.rows[0]) {
        throw new AppError("Invoice not found", 404);
    }

    const invoice = invRes.rows[0];

    const updateRes = await pool.query(
        `UPDATE "invoices"
         SET status = 'PAID',
             paid_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [invoiceId]
    );

    const paidInvoice = updateRes.rows[0];

    // Transition linked visit status to COMPLETED
    if (invoice.visit_id) {
        const visitRes = await pool.query<{ status: string }>(
            'SELECT status FROM "visits" WHERE id = $1',
            [invoice.visit_id]
        );
        if (visitRes.rowCount && visitRes.rows[0]) {
            const vStatus = visitRes.rows[0].status;
            if (vStatus !== "COMPLETED" && vStatus !== "CANCELLED") {
                const transitionAuth: AuthPayload = {
                    userId: authUser?.userId || "system",
                    email: authUser?.email || "system@hospital.internal",
                    role: "STAFF",
                    staffRole: (authUser?.staffRole as any) || "BILLING_CLERK",
                };

                if (vStatus !== "BILLING") {
                    if (vStatus === "REGISTERED") {
                        await updateVisitStatusService(invoice.visit_id, "VITALS", transitionAuth);
                        await updateVisitStatusService(invoice.visit_id, "WAITING_OPD", transitionAuth);
                        await updateVisitStatusService(invoice.visit_id, "BILLING", transitionAuth);
                    } else if (vStatus === "VITALS") {
                        await updateVisitStatusService(invoice.visit_id, "WAITING_OPD", transitionAuth);
                        await updateVisitStatusService(invoice.visit_id, "BILLING", transitionAuth);
                    } else if (vStatus === "WAITING_OPD" || vStatus === "IN_CONSULTATION") {
                        await updateVisitStatusService(invoice.visit_id, "BILLING", transitionAuth);
                    } else if (vStatus === "DIAGNOSTICS" || vStatus === "PHARMACY") {
                        await updateVisitStatusService(invoice.visit_id, "BILLING", transitionAuth);
                    }
                }

                await updateVisitStatusService(invoice.visit_id, "COMPLETED", transitionAuth);
            }
        }
    }

    const itemsRes = await pool.query(
        'SELECT * FROM "invoice_items" WHERE invoice_id = $1 ORDER BY created_at ASC',
        [invoiceId]
    );

    const baseInvoice = {
        ...paidInvoice,
        amount: paidInvoice.total_amount,
        items: itemsRes.rows.map((i) => ({
            ...i,
            quantity: 1,
            unit_price: i.amount,
            total_price: i.amount,
        })),
        invoice_items: itemsRes.rows,
        invoiceItems: itemsRes.rows,
    };

    return {
        ...baseInvoice,
        message: "Invoice marked as PAID",
        invoice: baseInvoice,
    };
}

export async function getInvoicesService(visitId?: string, patientId?: string, status?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (visitId) {
        params.push(visitId);
        conditions.push(`inv.visit_id = $${params.length}`);
    }

    if (patientId) {
        params.push(patientId);
        conditions.push(`inv.patient_id = $${params.length}`);
    }

    if (status) {
        params.push(status);
        conditions.push(`inv.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            inv.*,
            p.name as patient_name,
            u.name as generated_by_name
        FROM "invoices" inv
        JOIN "patient_profiles" p ON inv.patient_id = p.id
        LEFT JOIN "staff_profiles" sp ON inv.generated_by = sp.id
        LEFT JOIN "users" u ON sp.user_id = u.id
        ${whereClause}
        ORDER BY inv.created_at DESC
    `;

    const res = await pool.query(query, params);
    return res.rows.map((row) => ({
        ...row,
        amount: row.total_amount,
    }));
}

export async function getInvoiceByIdService(id: string) {
    const res = await pool.query(
        `SELECT 
            inv.*,
            p.name as patient_name,
            u.name as generated_by_name
         FROM "invoices" inv
         JOIN "patient_profiles" p ON inv.patient_id = p.id
         LEFT JOIN "staff_profiles" sp ON inv.generated_by = sp.id
         LEFT JOIN "users" u ON sp.user_id = u.id
         WHERE inv.id = $1`,
        [id]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Invoice not found", 404);
    }

    const itemsRes = await pool.query(
        'SELECT * FROM "invoice_items" WHERE invoice_id = $1 ORDER BY created_at ASC',
        [id]
    );

    return {
        ...res.rows[0],
        amount: res.rows[0].total_amount,
        items: itemsRes.rows.map((i) => ({
            ...i,
            quantity: 1,
            unit_price: i.amount,
            total_price: i.amount,
        })),
    };
}

export const getInvoicesByVisitService = (visitId: string) => getInvoicesService(visitId);
export const listInvoicesService = (visitId?: string, patientId?: string, status?: string) => getInvoicesService(visitId, patientId, status);

