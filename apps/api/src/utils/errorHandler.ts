import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
    public statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
    }
}

const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
    if (response.headersSent) {
        next(error);
        return;
    }

    if (error instanceof ZodError) {
        response.status(400).json({
            message: "Invalid request",
            errors: error.issues,
        });
        return;
    }

    if (error instanceof AppError) {
        response.status(error.statusCode).json({
            message: error.message,
        });
        return;
    }

    console.error(error);
    response.status(500).json({ message: "Internal Server Error" });
};

export default errorHandler;