import { z } from "zod";

export const doctorLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const updateDoctorProfileSchema = z.object({
    name: z.string().min(1).optional(),
    specialization: z.enum([
        "Cardiology",
        "Dermatology",
        "Neurology",
        "Pediatrics",
        "Psychiatry",
        "Radiology",
        "Surgery",
        "Urology",
        "Oncology",
        "Orthopedics"
    ]).optional(),
    department: z.string().min(1).optional(),
});

export const prescriptionItemSchema = z.object({
    medication: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().optional(),
    duration: z.string().optional(),
    instructions: z.string().optional(),
});

export const createConsultationSchema = z.object({
    appointmentId: z.string().uuid().optional(),
    diagnosis: z.string().min(1),
    notes: z.string().optional(),
    treatmentPlan: z.string().optional(),
    prescriptions: z.array(prescriptionItemSchema).optional(),
});

export const updateConsultationSchema = z.object({
    diagnosis: z.string().min(1).optional(),
    notes: z.string().optional(),
    treatmentPlan: z.string().optional(),
});

export const createInvestigationOrderSchema = z.object({
    testName: z.string().min(1),
    instructions: z.string().optional(),
});

export const patientIdParamSchema = z.object({
    patientId: z.string().uuid(),
});

export const consultationIdParamSchema = z.object({
    consultationId: z.string().uuid(),
});

export type DoctorLoginInput = z.infer<typeof doctorLoginSchema>;
export type UpdateDoctorProfileInput = z.infer<typeof updateDoctorProfileSchema>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type CreateInvestigationOrderInput = z.infer<typeof createInvestigationOrderSchema>;
