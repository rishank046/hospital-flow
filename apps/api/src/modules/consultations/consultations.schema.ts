import { z } from "zod";

export const prescriptionItemSchema = z.object({
    medication: z.string().min(1, "Medication name is required"),
    dosage: z.string().min(1, "Dosage is required"),
    frequency: z.string().optional().nullable(),
    duration: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
});

export const createConsultationSchema = z.object({
    visitId: z.string().uuid().optional().nullable(),
    visit_id: z.string().uuid().optional().nullable(),
    appointmentId: z.string().uuid().optional().nullable(),
    appointment_id: z.string().uuid().optional().nullable(),
    diagnosis: z.string().min(1, "Diagnosis is required"),
    notes: z.string().optional().nullable(),
    treatmentPlan: z.string().optional().nullable(),
    treatment_plan: z.string().optional().nullable(),
    prescriptions: z.array(prescriptionItemSchema).optional(),
});

export const updateConsultationSchema = z.object({
    diagnosis: z.string().optional(),
    notes: z.string().optional().nullable(),
    treatmentPlan: z.string().optional().nullable(),
    treatment_plan: z.string().optional().nullable(),
});

export const consultationIdParamSchema = z.object({
    consultationId: z.string().uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.string().uuid(),
});

export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
