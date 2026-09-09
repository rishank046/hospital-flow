import type { Request, Response } from "express";

const notImplemented = (_request: Request, response: Response) => {
	response.status(501).json({ message: "Patient endpoint not implemented" });
};

export const getMyProfile = notImplemented;
export const updateMyProfile = notImplemented;
export const getMyAppointments = notImplemented;
export const bookAppointment = notImplemented;
export const cancelAppointment = notImplemented;
export const getMyQueueStatus = notImplemented;
export const getMyJourney = notImplemented;
export const getMyConsultations = notImplemented;
export const getMyReports = notImplemented;
export const getMyPrescriptions = notImplemented;
