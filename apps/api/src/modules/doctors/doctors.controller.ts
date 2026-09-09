import type { Request, Response } from "express";

const notImplemented = (_request: Request, response: Response) => {
	response.status(501).json({ message: "Doctor endpoint not implemented" });
};

export const getMyProfile = notImplemented;
export const updateMyProfile = notImplemented;
export const getMySchedule = notImplemented;
export const getMyQueue = notImplemented;
export const getMyPatients = notImplemented;
export const getPatient = notImplemented;
export const createConsultation = notImplemented;
export const updateConsultation = notImplemented;
export const createInvestigationOrder = notImplemented;
export const getPatientReports = notImplemented;
export const completeQueueEntry = notImplemented;
export const skipQueueEntry = notImplemented;
export const login = notImplemented;