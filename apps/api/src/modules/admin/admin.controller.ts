import type { Request, Response } from "express";
import { adminLoginSchema, createDoctorSchema } from "./admin.schema.js";
import {
    adminLoginService,
    createDoctorService,
    listDoctorsService,
    listPatientsService,
} from "./admin.service.js";

export async function login(request: Request, response: Response) {
    const parsed = adminLoginSchema.parse(request.body);
    const result = await adminLoginService(parsed);
    response.status(200).json(result);
}

export async function createDoctor(request: Request, response: Response) {
    const parsed = createDoctorSchema.parse(request.body);
    const doctor = await createDoctorService(parsed);
    response.status(201).json(doctor);
}

export async function listDoctors(_request: Request, response: Response) {
    const doctors = await listDoctorsService();
    response.status(200).json(doctors);
}

export async function listPatients(_request: Request, response: Response) {
    const patients = await listPatientsService();
    response.status(200).json(patients);
}
