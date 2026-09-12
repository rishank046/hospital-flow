import { z } from "zod";

export const updatePatientProfileSchema = z.object({
    name: z.string().min(1).optional(),
    age: z.number().int().positive().optional(),
    gender: z.enum(["Male", "Female", "Other"]).optional(),
    patientType: z.enum(["Online", "Walkin"]).optional(),
    doctorId: z.string().uuid().optional(),
});

export const bookAppointmentSchema = z.object({
    doctorId: z.string().uuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
});

export const appointmentIdParamSchema = z.object({
    appointmentId: z.string().uuid(),
});

export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;