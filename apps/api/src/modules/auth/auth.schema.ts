import z from 'zod';

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const registerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.role !== undefined) {
        const normalized = data.role.toUpperCase();
        if (normalized === "STAFF" || normalized === "ADMIN" || normalized === "DOCTOR") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Registration with role STAFF or ADMIN is not permitted",
                path: ["role"],
            });
        }
    }
});

export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().uuid(),
    password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;