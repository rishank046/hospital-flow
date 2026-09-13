import type { Request, Response } from "express";
import {
    adminLoginSchema,
    createDoctorSchema,
    createStaffSchema,
    staffIdParamSchema,
    updateStaffSchema,
    updateStaffStatusSchema,
} from "./admin.schema.js";
import {
    adminLoginService,
    createDoctorService,
    createStaffService,
    listDoctorsService,
    listPatientsService,
    listStaffService,
    updateStaffService,
    updateStaffStatusService,
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

export async function createStaff(request: Request, response: Response) {
    const parsed = createStaffSchema.parse(request.body);
    const staff = await createStaffService(parsed);
    response.status(201).json(staff);
}

export async function updateStaff(request: Request, response: Response) {
    const { staffId } = staffIdParamSchema.parse(request.params);
    const parsed = updateStaffSchema.parse(request.body);
    const updated = await updateStaffService(staffId, parsed);
    response.status(200).json(updated);
}

export async function updateStaffStatus(request: Request, response: Response) {
    const { staffId } = staffIdParamSchema.parse(request.params);
    const parsed = updateStaffStatusSchema.parse(request.body);
    const updated = await updateStaffStatusService(staffId, parsed);
    response.status(200).json(updated);
}

export async function listStaff(_request: Request, response: Response) {
    const staff = await listStaffService();
    response.status(200).json(staff);
}

