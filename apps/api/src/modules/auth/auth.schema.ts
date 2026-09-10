import z from 'zod';
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});

export const registerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6)
});

export const forgotPasswordSchema = z.object({
    email: z.string().email()
});

export const resetPasswordSchema = z.object({
    token: z.string().uuid(),
    password: z.string().min(6)
});