import { z } from "zod";

export const appointmentTypeEnum = z.enum(["CONSULTATION", "FOLLOW_UP", "PROCEDURE"]);
export const appointmentStatusEnum = z.enum([
    "SCHEDULED",
    "CHECKED_IN",
    "COMPLETED",
    "NO_SHOW",
    "CANCELLED",
]);

export const createAppointmentSchema = z
    .object({
        patientId: z.string().uuid().optional(),
        patient_id: z.string().uuid().optional(),
        doctorId: z.string().uuid().optional(),
        doctor_id: z.string().uuid().optional(),
        startTime: z.string().datetime().or(z.string().min(10)).optional(),
        start_time: z.string().datetime().or(z.string().min(10)).optional(),
        endTime: z.string().datetime().or(z.string().min(10)).optional(),
        end_time: z.string().datetime().or(z.string().min(10)).optional(),
        type: appointmentTypeEnum.optional().default("CONSULTATION"),
    })
    .refine((data) => Boolean(data.patientId || data.patient_id), {
        message: "patientId (or patient_id) is required",
    })
    .refine((data) => Boolean(data.doctorId || data.doctor_id), {
        message: "doctorId (or doctor_id) is required",
    })
    .refine((data) => Boolean(data.startTime || data.start_time), {
        message: "startTime (or start_time) is required",
    });

export const checkAvailabilitySchema = z.object({
    doctorId: z.string().uuid().optional(),
    doctor_id: z.string().uuid().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export const appointmentIdParamSchema = z.object({
    appointmentId: z.string().uuid(),
});

export const listAppointmentsQuerySchema = z.object({
    patientId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    status: appointmentStatusEnum.optional(),
    date: z.string().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type CheckAvailabilityQuery = z.infer<typeof checkAvailabilitySchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
