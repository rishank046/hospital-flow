import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    callNextCashCounter,
    enqueueCashCounter,
    generateInvoice,
    getCashCounterQueue,
    getInvoiceById,
    getInvoicesByVisit,
    listInvoices,
    payCashInvoice,
    payInvoice,
} from "./billing.controller.js";

const router = express.Router();

// Cash Counter Queue pipeline
router.post("/cash-queue", authenticate, wrapper(enqueueCashCounter));
router.get("/cash-queue", authenticate, wrapper(getCashCounterQueue));
router.post("/cash-queue/call-next", authenticate, requireRole("STAFF"), wrapper(callNextCashCounter));
router.post("/cash-queue/:queueEntryId/pay", authenticate, requireRole("STAFF"), wrapper(payCashInvoice));
router.post("/cash-pay/:queueEntryId", authenticate, requireRole("STAFF"), wrapper(payCashInvoice));

// Mounted at /visits (matches /visits/:visitId/invoice, /visits/:visitId/invoices)
router.post("/:visitId/invoice", authenticate, requireRole("STAFF"), wrapper(generateInvoice));
router.get("/:visitId/invoices", authenticate, wrapper(getInvoicesByVisit));

// Mounted at /invoices (matches /invoices/:id/pay, /invoices/:id, /invoices)
router.get("/", authenticate, wrapper(listInvoices));
router.patch("/:id/pay", authenticate, requireRole("STAFF"), wrapper(payInvoice));
router.get("/:id", authenticate, wrapper(getInvoiceById));

export default router;
