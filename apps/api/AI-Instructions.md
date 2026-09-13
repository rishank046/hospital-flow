# AI INSTRUCTIONS — HOSPITAL FLOW BACKEND (`apps/api`)

> **CRITICAL DIRECTIVE FOR AI ASSISTANTS & AGENTS**:  
> You are acting as a Senior Backend Architect and Security Engineer on the **Hospital Flow API**.  
> You must strictly adhere to the architecture, directory structure, coding standards, and security mandates defined in this document.  
> **DO NOT generate monolithic single-file code.**  
> **DO NOT place database queries inside controllers or routes.**  
> **DO NOT bypass authentication, authorization, input validation, or password hashing.**

---

## 1. Project Overview & Tech Stack

Hospital Flow is a clinical management and patient workflow platform coordinating patients, doctors, appointments, consultations, prescriptions, lab investigation orders, queues, and real-time updates.

### Technology Stack
- **Runtime:** Node.js (v20+)
- **Module System:** ECMAScript Modules (`"type": "module"`, NodeNext resolution)
- **Language:** TypeScript (`strict: true`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`)
- **HTTP Framework:** Express 5 (`express@^5.2.1`)
- **Database:** PostgreSQL accessed via `pg` (`Pool`), raw parameterized SQL
- **Validation:** Zod (`zod@^4.x` / `3.x`)
- **Authentication & Security:** JWT (`jsonwebtoken`), Password Hashing (`bcrypt`, 10 salt rounds), In-memory Token Revocation
- **Real-time:** WebSocket (`ws`)
- **Testing:** Vitest (`vitest`)

---

## 2. Strict Modular File Structure (NO MONOLITHS)

All backend features MUST follow the **4-Tier Modular Architecture** under `src/modules/<feature>/`.  
Never dump everything into a single file, `app.ts`, or `server.ts`.

### Project Layout
```text
apps/api/
├── src/
│   ├── app.ts                 # Express app initialization, CORS, global middleware, route mounts ONLY
│   ├── server.ts              # HTTP server listen, WebSocket setup, database schema sync ONLY
│   ├── config/                # Environment variables, constants
│   ├── database/
│   │   ├── pool.ts            # PostgreSQL pg.Pool singleton
│   │   └── projectSchema.ts   # DDL tables, types, idempotent migrations
│   ├── middleware/
│   │   └── auth.middleware.ts # authenticate (JWT verify) & requireRole (RBAC guard)
│   ├── modules/               # Domain feature modules (4-tier pattern)
│   │   ├── auth/              # Authentication & user sessions
│   │   ├── patients/          # Patient profiles, appointments, journey, medical records
│   │   ├── doctors/           # Doctor profiles, schedule, consultations, lab orders
│   │   ├── appointments/      # Dedicated appointment scheduling (when extracted)
│   │   ├── consultations/     # Clinical consultations & notes
│   │   ├── prescriptions/     # Medication prescriptions
│   │   ├── lab-orders/        # Lab tests & diagnostic reports
│   │   ├── queue/             # Queue management & state transitions
│   │   ├── departments/       # Hospital department registries
│   │   └── notifications/     # Event-driven alerts & WebSocket notifications
│   ├── types/
│   │   └── express.d.ts       # Express Request typing augmentation (tokenPayload)
│   ├── utils/
│   │   ├── errorHandler.ts    # AppError class and centralized Express error handler
│   │   ├── wrapper.ts         # Async route wrapper for automatic promise rejection handling
│   │   ├── signTokenWrapper.ts# Promise-based JWT sign and verify helpers
│   │   └── tokenRevocation.ts # In-memory revoked token storage and expiry check
│   └── websocket/
│       ├── websocket.server.ts # WebSocket server bootstrap
│       └── websocket.handler.ts# Connection and message event dispatcher
├── test/
│   └── *.test.ts              # Vitest integration and unit tests
├── package.json
└── tsconfig.json
```

---

## 3. The 4-Tier Module Pattern (MANDATORY)

Every feature module inside `src/modules/<feature>/` MUST contain exactly these four separate files:

| File | Purpose & Responsibilities | FORBIDDEN in this file |
| :--- | :--- | :--- |
| `<feature>.schema.ts` *(or existing singular schema filenames such as `patient.schema.ts` / `doctor.schema.ts`)* | Zod validation schemas for `body`, `params`, `query`. TypeScript types inferred via `z.infer`. | NO database queries, NO Express handlers. |
| `<feature>.service.ts` | Core business logic, PostgreSQL queries (`pool.query`), transaction handling, throwing `AppError`. | NO Express `req` or `res` objects. NO HTTP status codes directly returned. |
| `<feature>.controller.ts` | Request input extraction, Zod parsing (`schema.parse()`), calling service functions, returning HTTP JSON status (`200`, `201`). | NO raw SQL queries (`pool.query`), NO direct business logic rules. |
| `<feature>.route.ts` | Express `Router()`, attaching `authenticate`, `requireRole(...)`, and `wrapper(controllerFunction)`. | NO inline request handlers, NO business logic, NO SQL queries. |

### Concrete Code Examples for Each Tier

#### 1. Schema Tier (`<feature>.schema.ts`)
```ts
import { z } from "zod";

export const createAppointmentSchema = z.object({
    doctorId: z.string().uuid("Doctor ID must be a valid UUID"),
    startTime: z.string().datetime("Start time must be ISO datetime"),
    endTime: z.string().datetime("End time must be ISO datetime"),
});

export const appointmentIdParamSchema = z.object({
    appointmentId: z.string().uuid("Appointment ID must be a valid UUID"),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
```

#### 2. Service Tier (`<feature>.service.ts`)
```ts
import pool from "#database/pool.js";
import { AppError } from "#utils/errorHandler.js";
import type { CreateAppointmentInput } from "./appointment.schema.js";

export async function createAppointmentService(
    patientUserId: string,
    data: CreateAppointmentInput
) {
    // 1. Resolve patient ID
    const patientRes = await pool.query<{ id: string }>(
        'SELECT id FROM "Patient" WHERE owner_user_id = $1',
        [patientUserId]
    );
    if (!patientRes.rows[0]) {
        throw new AppError("Patient profile not found", 404);
    }
    const patientId = patientRes.rows[0].id;

    // 2. Validate time boundaries
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (end <= start) {
        throw new AppError("End time must be strictly after start time", 400);
    }

    // 3. Best-effort conflict pre-check (still require DB-level overlap protection)
    const conflict = await pool.query(
        `SELECT id FROM "Appointment"
         WHERE doctor_id = $1
           AND (start_time < $3 AND end_time > $2)`,
        [data.doctorId, start.toISOString(), end.toISOString()]
    );
    if ((conflict.rowCount ?? 0) > 0) {
        throw new AppError("Doctor already has an appointment during this time slot", 409);
    }
    // Add a DB exclusion constraint (or equivalent transactional lock) to prevent race-condition overlaps.

    // 4. Insert record
    const result = await pool.query(
        `INSERT INTO "Appointment" (doctor_id, patient_id, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         RETURNING id, doctor_id, patient_id, start_time, end_time, created_at`,
        [data.doctorId, patientId, start.toISOString(), end.toISOString()]
    );

    return result.rows[0];
}
```

#### 3. Controller Tier (`<feature>.controller.ts`)
```ts
import type { Request, Response } from "express";
import { AppError } from "#utils/errorHandler.js";
import { createAppointmentSchema } from "./appointment.schema.js";
import { createAppointmentService } from "./appointment.service.js";

export async function bookAppointment(request: Request, response: Response) {
    const userId = request.tokenPayload?.userId;
    if (!userId) {
        throw new AppError("Authentication identity missing", 401);
    }

    // Validate request body against schema
    const parsedBody = createAppointmentSchema.parse(request.body);

    // Call service layer
    const appointment = await createAppointmentService(userId, parsedBody);

    // Return structured HTTP response
    response.status(201).json(appointment);
}
```

#### 4. Route Tier (`<feature>.route.ts`)
```ts
import express from "express";
import { authenticate, requireRole } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";
import { bookAppointment } from "./appointment.controller.js";

const router = express.Router();

router.post(
    "/appointments",
    authenticate,
    requireRole("PATIENT"),
    wrapper(bookAppointment)
);

export default router;
```

---

## 4. TypeScript & Node ESM Specifics (CRITICAL)

The project uses `"module": "nodenext"` and `"verbatimModuleSyntax": true`. Violations will fail the compiler.

1. **Explicit `.js` in Local and Wildcard-Alias Imports**:
   Always append `.js` to local imports and wildcard alias imports even though the source file is `.ts`.
   ```ts
   // CORRECT
   import pool from "#database/pool.js";
   import { AppError } from "#utils/errorHandler.js";
   import authRoute from "#modules/auth/auth.route.js";
   import { myHelper } from "./myHelper.js";

   // INCORRECT (Will break runtime & compilation)
   import pool from "#database/pool";
   import { AppError } from "../utils/errorHandler";
   ```

   Keep exact package keys as configured (for example `#app` must be imported as `#app`, not `#app.js`).

2. **Package Subpath Imports**:
   Use configured package imports from `package.json`:
   - `#app` -> `./src/app.js`
   - `#database/*` -> `./src/database/*`
   - `#middleware/*` -> `./src/middleware/*`
   - `#modules/*` -> `./src/modules/*`
   - `#utils/*` -> `./src/utils/*`
   - `#websocket/*` -> `./src/websocket/*`

3. **Type-Only Imports**:
   When importing types or interfaces, always use `import type`:
   ```ts
   // CORRECT
   import type { Request, Response, NextFunction } from "express";
   import type { AuthPayload } from "#middleware/auth.middleware.js";

   // INCORRECT under verbatimModuleSyntax
   import { Request, Response } from "express";
   ```

4. **Array and Property Access**:
   With `noUncheckedIndexedAccess: true`, accessing elements like `res.rows[0]` returns `T | undefined`. Always verify existence:
   ```ts
   const user = result.rows[0];
   if (!user) {
       throw new AppError("Record not found", 404);
   }
   ```

---

## 5. Security Mandates (NON-NEGOTIABLE)

### A. Passwords
- **ALWAYS** hash passwords with `bcrypt.hash(password, 10)` before storing.
- **ALWAYS** verify passwords with `bcrypt.compare(password, user.password)`.
- **NEVER** store plain-text passwords.
- **NEVER** return password or password hashes in API responses (`SELECT` only necessary columns or omit password).

### B. SQL Injection Prevention
- **ALWAYS** use parameterized queries with placeholders (`$1, $2, $3`).
- **NEVER** interpolate untrusted values into SQL strings (no string concatenation/interpolation with user input).
- Static template literals are allowed for multiline SQL only when all runtime values are passed through placeholders (`$1`, `$2`, ...).
```ts
// SECURE:
await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);

// CRITICAL VULNERABILITY (DO NOT DO THIS):
await pool.query(`SELECT * FROM "User" WHERE email = '${email}'`);
```

### C. Authentication & Authorization (RBAC)
- All private routes MUST have `authenticate`.
- All role-guarded routes MUST have `requireRole("PATIENT" | "DOCTOR" | "ADMIN")`.
- Verify resource ownership:
  - Patients can ONLY access their own records (`owner_user_id = tokenPayload.userId`).
  - Doctors can ONLY access records after explicit ownership checks (for example assigned patient or approved department scope) in each endpoint.
- Token revocation: Always verify if token has been invalidated using `isTokenRevoked(token)`.

### D. Input Validation (Zod)
- Every incoming request body, query parameter, and route parameter (`:id`) MUST be parsed using Zod before any processing.
- Reject unexpected or invalid inputs with clear error messages via `ZodError` (which converts to `400 Bad Request`).

### E. Error Handling & Information Leakage
- Custom errors MUST extend `AppError(message, statusCode)`.
- Never expose internal database error details, stack traces, or SQL statements to clients.
- Always pipe route handlers through `wrapper(fn)` to catch unhandled async rejections and route them to `errorHandler`.

### F. Environment Variables & Secrets
- Never hardcode credentials, JWT secrets, or DB connection strings.
- Always access via `process.env.DATABASE_URL`, `process.env.JWT_SECRET`, `process.env.PORT`.

---

## 6. HTTP Status Code Reference

| Status Code | Meaning | When to Use |
| :--- | :--- | :--- |
| `200 OK` | Success | Reading resources, successful updates, logins, deletions |
| `201 Created` | Resource Created | Successful registration, new appointment booked, consultation created |
| `400 Bad Request` | Validation Failure | Zod schema validation errors, malformed payload, invalid query |
| `401 Unauthorized` | Missing / Invalid Auth | Missing Bearer token, expired JWT, revoked token, bad credentials |
| `403 Forbidden` | Insufficient Role | User role mismatch (e.g. Patient accessing Doctor endpoints) |
| `404 Not Found` | Entity Missing | Target record (Doctor, Patient, Appointment) does not exist |
| `409 Conflict` | Business Conflict | Double-booking appointment time slot, duplicate unique email |
| `500 Internal Error` | Server Error | Uncaught database connection drops or unexpected exceptions |
| `501 Not Implemented`| Stubbed Endpoint | Feature intentionally deferred (e.g. Queue management) |

---

## 7. Verification & Testing Workflow

Before finalizing any backend code, verify with the following commands in the workspace root:

1. **Typecheck Backend:**
   ```bash
   ./apps/api/node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit
   ```
   *Must exit with 0 errors.*

2. **Run Backend Tests:**
   ```bash
   npm --prefix apps/api test
   ```
   *All Vitest suites must pass.*

3. **Start Development Server:**
   ```bash
   npm --prefix apps/api run dev
   ```

---

## 8. Summary Checklist for AI Generation

When generating or editing backend code:
- [ ] Is the code placed in the appropriate `src/modules/<feature>/` folder?
- [ ] Are schema, service, controller, and route kept in separate files?
- [ ] Do all local and package alias imports include `.js`?
- [ ] Are all types imported with `import type`?
- [ ] Are all passwords hashed with bcrypt?
- [ ] Are all SQL queries parameterized with `$1, $2`?
- [ ] Are route endpoints protected with `authenticate` and `requireRole`?
- [ ] Are all inputs validated using Zod?
- [ ] Are async controllers wrapped with `wrapper(...)`?
- [ ] Do errors use `new AppError(message, statusCode)`?
