import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { AuthPayload } from "#types/auth.types.js";
import { updateVisitStatusService } from "#modules/visits/visits.service.js";
import type { GenerateInvoiceInput, PayInvoiceInput } from "./billing.schema.js";

interface DerivedItem {
    description: string;
    item_type: string;
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
        'SELECT * FROM "Consultation" WHERE visit_id = $1',
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
        'SELECT * FROM "InvestigationOrder" WHERE visit_id = $1',
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
        `SELECT pr.*, COALESCE(pd.dispensed_quantity, 1) as dispensed_qty
         FROM "Prescription" pr
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
            derivedItems.push({
                description: item.description,
                item_type: item.itemType || item.item_type || "OTHER",
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

    // Create invoice record
    const invoiceRes = await pool.query(
        `INSERT INTO "invoices" (
            visit_id,
            patient_id,
            amount,
            status,
            items
         )
         VALUES ($1, $2, $3, 'PENDING', $4)
         RETURNING *`,
        [
            visitId,
            visit.patient_id,
            totalAmount,
            JSON.stringify(derivedItems),
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
                quantity,
                unit_price,
                total_price
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                invoice.id,
                item.description,
                item.item_type,
                item.quantity,
                item.unit_price,
                item.total_price,
            ]
        );
        createdItems.push(itemRes.rows[0]);
    }

    // Transition visit status to BILLING if applicable
    const transitionAuth: AuthPayload = {
        userId: authUser?.userId || "system",
        email: authUser?.email || "billing@hospital.internal",
        role: "STAFF",
        staffRole: (authUser?.staffRole as any) || "BILLING_CLERK",
    };

    if (
        visit.status !== "BILLING" &&
        visit.status !== "COMPLETED" &&
        visit.status !== "CANCELLED"
    ) {
        try {
            await updateVisitStatusService(visitId, "BILLING", transitionAuth);
        } catch {
            // If transition from current state is not directly allowed, ignore or continue
        }
    }

    return {
        ...invoice,
        invoice_items: createdItems,
        invoiceItems: createdItems,
    };
}

export async function payInvoiceService(
    invoiceId: string,
    data?: PayInvoiceInput,
    authUser?: AuthPayload
) {
    const invoiceRes = await pool.query(
        'SELECT * FROM "invoices" WHERE id = $1',
        [invoiceId]
    );

    if (invoiceRes.rowCount === 0 || !invoiceRes.rows[0]) {
        throw new AppError("Invoice not found", 404);
    }

    const invoice = invoiceRes.rows[0];

    const updateRes = await pool.query(
        `UPDATE "invoices"
         SET status = 'PAID',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [invoiceId]
    );

    const updatedInvoice = updateRes.rows[0];

    // Transition visit status to COMPLETED
    if (invoice.visit_id) {
        const visitRes = await pool.query<{ status: string }>(
            'SELECT status FROM "visits" WHERE id = $1',
            [invoice.visit_id]
        );
        if (visitRes.rowCount && visitRes.rows[0]) {
            const vStatus = visitRes.rows[0].status;
            const transitionAuth: AuthPayload = {
                userId: authUser?.userId || "system",
                email: authUser?.email || "billing@hospital.internal",
                role: "STAFF",
                staffRole: (authUser?.staffRole as any) || "BILLING_CLERK",
            };

            if (vStatus !== "COMPLETED" && vStatus !== "CANCELLED") {
                if (vStatus !== "BILLING") {
                    try {
                        await updateVisitStatusService(invoice.visit_id, "BILLING", transitionAuth);
                    } catch {
                        // ignore
                    }
                }
                try {
                    await updateVisitStatusService(invoice.visit_id, "COMPLETED", transitionAuth);
                } catch {
                    // ignore
                }
            }
        }
    }

    // Fetch items
    const itemsRes = await pool.query(
        'SELECT * FROM "invoice_items" WHERE invoice_id = $1 ORDER BY created_at ASC',
        [invoiceId]
    );

    return {
        message: "Invoice marked as PAID",
        invoice: {
            ...updatedInvoice,
            invoice_items: itemsRes.rows,
            invoiceItems: itemsRes.rows,
        },
    };
}

export async function getInvoiceByIdService(invoiceId: string) {
    const res = await pool.query(
        `SELECT i.*, p.name as patient_name
         FROM "invoices" i
         JOIN "Patient" p ON i.patient_id = p.id
         WHERE i.id = $1`,
        [invoiceId]
    );

    if (res.rowCount === 0 || !res.rows[0]) {
        throw new AppError("Invoice not found", 404);
    }

    const itemsRes = await pool.query(
        'SELECT * FROM "invoice_items" WHERE invoice_id = $1 ORDER BY created_at ASC',
        [invoiceId]
    );

    return {
        ...res.rows[0],
        invoice_items: itemsRes.rows,
        invoiceItems: itemsRes.rows,
    };
}

export async function getInvoicesByVisitService(visitId: string) {
    const res = await pool.query(
        'SELECT * FROM "invoices" WHERE visit_id = $1 ORDER BY created_at DESC',
        [visitId]
    );
    return res.rows;
}

export async function listInvoicesService(status?: string) {
    const params: unknown[] = [];
    let query = `
        SELECT i.*, p.name as patient_name
        FROM "invoices" i
        JOIN "Patient" p ON i.patient_id = p.id
    `;
    if (status) {
        params.push(status);
        query += ` WHERE i.status = $1`;
    }
    query += ` ORDER BY i.created_at DESC`;
    const res = await pool.query(query, params);
    return res.rows;
}

