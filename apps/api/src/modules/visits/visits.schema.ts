import { z } from "zod";

export const visitStatusEnum = z.enum([
    "REGISTERED",
    "VITALS",
    "WAITING_OPD",
    "IN_CONSULTATION",
    "DIAGNOSTICS",
    "PHARMACY",
    "BILLING",
    "COMPLETED",
    "CANCELLED",
]);

export const visitTypeEnum = z.enum([
    "OPD",
    "EMERGENCY",
    "ONLINE",
    "WALKIN",
    "APPOINTMENT",
    "ROUTINE",
    "CONSULTATION",
    "FOLLOW_UP",
]);

export const createVisitSchema = z
    .object({
        patient_id: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        visit_type: z.string().min(1).optional(),
        visitType: z.string().min(1).optional(),
        department_id: z.string().uuid().optional().nullable(),
        departmentId: z.string().uuid().optional().nullable(),
        appointment_id: z.string().uuid().optional().nullable(),
        appointmentId: z.string().uuid().optional().nullable(),
        assigned_doctor_id: z.string().uuid().optional().nullable(),
        assignedDoctorId: z.string().uuid().optional().nullable(),
        registered_by: z.string().uuid().optional().nullable(),
        registeredBy: z.string().uuid().optional().nullable(),
    })
    .refine((data) => Boolean(data.patient_id || data.patientId), {
        message: "patient_id is required",
        path: ["patient_id"],
    })
    .refine((data) => Boolean(data.visit_type || data.visitType), {
        message: "visit_type is required",
        path: ["visit_type"],
    })
    .transform((data) => ({
        patientId: (data.patient_id || data.patientId)!,
        visitType: (data.visit_type || data.visitType)!,
        departmentId:
            data.department_id !== undefined ? data.department_id : data.departmentId ?? null,
        appointmentId:
            data.appointment_id !== undefined ? data.appointment_id : data.appointmentId ?? null,
        assignedDoctorId:
            data.assigned_doctor_id !== undefined
                ? data.assigned_doctor_id
                : data.assignedDoctorId ?? null,
        registeredBy:
            data.registered_by !== undefined ? data.registered_by : data.registeredBy ?? null,
    }));

export const updateVisitStatusSchema = z.object({
    status: visitStatusEnum,
});

export const visitIdParamSchema = z.object({
    id: z.string().uuid(),
});

export type VisitStatus = z.infer<typeof visitStatusEnum>;
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitStatusInput = z.infer<typeof updateVisitStatusSchema>;
export type VisitIdParam = z.infer<typeof visitIdParamSchema>;
