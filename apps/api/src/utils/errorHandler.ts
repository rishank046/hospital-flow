import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

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

    console.error(error);
    response.status(500).json({ message: "Internal Server Error" });
}

export default errorHandler;