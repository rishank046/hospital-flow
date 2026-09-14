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

export {
    prescriptionItemSchema,
    createConsultationSchema,
    updateConsultationSchema,
} from "#modules/consultations/consultations.schema.js";
export type {
    CreateConsultationInput,
    UpdateConsultationInput,
} from "#modules/consultations/consultations.schema.js";

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
export type CreateInvestigationOrderInput = z.infer<typeof createInvestigationOrderSchema>;
