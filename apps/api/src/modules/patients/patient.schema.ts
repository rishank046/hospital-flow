import { z } from "zod";

export const createPatientProfileSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().nonnegative(),
    gender: z.enum(["Male", "Female", "Other"]),
    patientType: z.enum(["Online", "Walkin"]).optional().default("Online"),
});

export const updatePatientProfileSchema = z.object({
    name: z.string().min(1).optional(),
    age: z.number().int().nonnegative().optional(),
    gender: z.enum(["Male", "Female", "Other"]).optional(),
    patientType: z.enum(["Online", "Walkin"]).optional(),
    doctorId: z.string().uuid().optional(),
});

export const patientIdParamSchema = z.object({
    patientId: z.string().uuid(),
});

export const bookAppointmentSchema = z.object({
    patientId: z.string().uuid().optional(),
    doctorId: z.string().uuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    type: z.enum(["CONSULTATION", "FOLLOW_UP", "EMERGENCY", "ROUTINE"]).optional().default("CONSULTATION"),
});

export const appointmentIdParamSchema = z.object({
    appointmentId: z.string().uuid(),
});

export type CreatePatientProfileInput = z.infer<typeof createPatientProfileSchema>;
export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;