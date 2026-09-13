import type { Request, Response } from "express";
import { AppError } from "#utils/errorHandler.js";
import { staffIdParamSchema } from "./staff.schema.js";
import {
    getStaffByIdService,
    getStaffProfileService,
    listStaffService,
} from "./staff.service.js";

export async function getMyStaffProfile(request: Request, response: Response) {
    const userId = request.user?.userId;
    if (!userId) {
        throw new AppError("Authentication identity missing from token", 401);
    }
    const profile = await getStaffProfileService(userId);
    response.status(200).json(profile);
}

export async function getStaffById(request: Request, response: Response) {
    const { staffId } = staffIdParamSchema.parse(request.params);
    const staff = await getStaffByIdService(staffId);
    response.status(200).json(staff);
}

export async function listStaff(_request: Request, response: Response) {
    const staff = await listStaffService();
    response.status(200).json(staff);
}

export async function staffLogin(request: Request, response: Response) {
    const { loginSchema } = await import("#modules/auth/auth.schema.js");
    const { loginService } = await import("#modules/auth/auth.service.js");
    const parsed = loginSchema.parse(request.body);
    const result = await loginService(parsed.email, parsed.password);

    // Verify account is staff (including DOCTOR) or ADMIN
    if (!result.user || (result.user.role !== "STAFF" && result.user.role !== "ADMIN")) {
        throw new AppError("Access denied: this account is not registered as hospital staff", 403);
    }

    response.status(200).json(result);
}
