import { z } from "zod";

export const adminLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const createDoctorSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
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
        "Orthopedics",
    ]),
    department: z.string().min(1),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

export {
    createStaffSchema,
    updateStaffSchema,
    updateStaffStatusSchema,
    staffIdParamSchema,
    type CreateStaffInput,
    type UpdateStaffInput,
    type UpdateStaffStatusInput,
} from "#modules/staff/staff.schema.js";
