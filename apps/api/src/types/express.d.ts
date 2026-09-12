import type { AuthPayload } from "../middleware/auth.middleware.js";

declare global {
    namespace Express {
        interface Request {
            tokenPayload?: AuthPayload;
        }
    }
}

export {};