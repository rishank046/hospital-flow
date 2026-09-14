import { z } from "zod";

export const recordVitalsSchema = z.object({
    temperature: z.number().optional().nullable(),
    heartRate: z.number().int().optional().nullable(),
    heart_rate: z.number().int().optional().nullable(),
    bloodPressure: z.string().optional().nullable(),
    blood_pressure: z.string().optional().nullable(),
    respiratoryRate: z.number().int().optional().nullable(),
    respiratory_rate: z.number().int().optional().nullable(),
    oxygenSaturation: z.number().optional().nullable(),
    oxygen_saturation: z.number().optional().nullable(),
    weight: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export const visitIdParamSchema = z.object({
    visitId: z.string().uuid(),
});

export const vitalsIdParamSchema = z.object({
    id: z.string().uuid(),
});

export type RecordVitalsInput = z.infer<typeof recordVitalsSchema>;
