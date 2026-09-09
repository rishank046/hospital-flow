import type { NextFunction, Request, RequestHandler, Response } from "express";

export const authenticate: RequestHandler = (
    _request: Request,
    response: Response,
    _next: NextFunction,
) => {
    response.status(501).json({ message: "Authentication middleware not implemented" });
};

export const requireRole = (_role: string): RequestHandler => (
    _request: Request,
    response: Response,
    _next: NextFunction,
) => {
    response.status(501).json({ message: "Role authorization middleware not implemented" });
};