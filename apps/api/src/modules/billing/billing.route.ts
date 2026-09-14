import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import {
    generateInvoice,
    getInvoiceById,
    getInvoicesByVisit,
    listInvoices,
    payInvoice,
} from "./billing.controller.js";

const router = express.Router();

// Mounted at /visits (matches /visits/:visitId/invoice, /visits/:visitId/invoices)
router.post("/:visitId/invoice", authenticate, requireRole("STAFF"), wrapper(generateInvoice));
router.get("/:visitId/invoices", authenticate, wrapper(getInvoicesByVisit));

// Mounted at /invoices (matches /invoices/:id/pay, /invoices/:id, /invoices)
router.get("/", authenticate, wrapper(listInvoices));
router.patch("/:id/pay", authenticate, requireRole("STAFF"), wrapper(payInvoice));
router.get("/:id", authenticate, wrapper(getInvoiceById));

export default router;
