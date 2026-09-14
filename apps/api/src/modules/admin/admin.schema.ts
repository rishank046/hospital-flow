import { z } from "zod";

export const adminLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const doctorSpecializationEnum = z.enum([
    "Cardiology",
    "Dermatology",
    "Neurology",
    "Pediatrics",
    "Psychiatry",
    "Radiology",
    "Surgery",
    "Urology",
    "Oncology",
    "Orthopedics",
    "General Medicine",
]);

export const staffRolesEnum = z.enum([
    "DOCTOR",
    "NURSE",
    "RECEPTIONIST",
    "LAB_STAFF",
    "LAB_TECH",
    "PHARMACIST",
    "BILLING_CLERK",
]);

export const staffStatusEnum = z.enum([
    "ACTIVE",
    "INACTIVE",
    "ON_LEAVE",
]);

export const createDoctorSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    specialization: doctorSpecializationEnum,
    department: z.string().min(1),
});

export const createStaffSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6).optional(),
    employeeCode: z.string().min(1).optional(),
    role: staffRolesEnum,
    status: staffStatusEnum.optional().default("ACTIVE"),
    specialization: doctorSpecializationEnum.optional(),
    department: z.string().min(1).optional(),
    departmentId: z.string().uuid().optional(),
    licenseNumber: z.string().optional(),
});

export const updateStaffStatusSchema = z.object({
    status: staffStatusEnum,
});

export const updateStaffSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    employeeCode: z.string().min(1).optional(),
    role: staffRolesEnum.optional(),
    status: staffStatusEnum.optional(),
    departmentId: z.string().uuid().optional(),
    department: z.string().optional(),
    specialization: doctorSpecializationEnum.optional(),
});

export const staffIdParamSchema = z.object({
    staffId: z.string().uuid(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type CreateDoctorAdminInput = CreateDoctorInput;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
