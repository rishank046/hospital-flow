import type { Request, Response } from "express";
import {verifyToken} from "#utils/signTokenWrapper.js";
import { getMyProfileService } from "#modules/patients/patients.service.js";

const notImplemented = (_request: Request, response: Response) => {
	response.status(501).json({ message: "Patient endpoint not implemented" });
};

export async function getMyProfile(request: Request, response: Response) {
	const email = request.tokenPayload?.email;
	if(!email){
		throw new Error("Email not found in token payload");
	}
	const result = await getMyProfileService(email);

	response.status(200).json(result);
}

export const updateMyProfile = notImplemented;
export const getMyAppointments = notImplemented;
export const bookAppointment = notImplemented;
export const cancelAppointment = notImplemented;
export const getMyQueueStatus = notImplemented;
export const getMyJourney = notImplemented;
export const getMyConsultations = notImplemented;
export const getMyReports = notImplemented;
export const getMyPrescriptions = notImplemented;
