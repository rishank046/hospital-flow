# Architectural Decisions & Implementation Plan: Patient & Doctor Modules

**Date:** 2026-09-12  
**Status:** Approved / In Planning  
**Scope:** Patient & Doctor Controllers, Services, Schemas, and DB Models (excluding Queue management)

---

## 1. Context & Scope

Hospital Flow requires core functionality for Patients and Doctors to interact with the system:
- **Patients** must be able to view and update their profile, book and cancel appointments, track their journey timeline, and retrieve past consultations, prescriptions, and medical reports.
- **Doctors** must be able to authenticate, view/update their profile, check their daily schedule, browse assigned patients and patient histories, create/update consultations, prescribe medications, and issue investigation/lab orders.
- **Queue System Exclusion:** As specified, all queue-related endpoints (`/patients/me/queue`, `/doctors/me/queue`, `/doctors/queue/:queueEntryId/complete`, and `/doctors/queue/:queueEntryId/skip`) are explicitly excluded from this implementation and remain as `501 Not Implemented`.

---

## 2. Architectural Decisions

### ADR 1: Idempotent PostgreSQL Types & UUID Primary Keys
- **Problem:** PostgreSQL does not support `CREATE TYPE IF NOT EXISTS`, causing syntax errors on server bootstrap (`server.ts`). Furthermore, existing database tables were created with legacy `int4` keys instead of the target UUID schema.
- **Decision:**
  - Update [projectSchema.ts](file:///home/rishank/Documents/projects/hospital-flow/apps/api/src/database/projectSchema.ts) to use idempotent `DO $$ BEGIN IF NOT EXISTS (...) THEN CREATE TYPE ... END IF; END $$;` blocks.
  - Standardize all entities on `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
  - Safely sync the empty database tables with the modern schema.

### ADR 2: Dedicated Doctor Authentication Credentials
- **Problem:** Doctors authenticate through `POST /doctors/login`, but the `"Doctor"` table did not include `email` or `password` columns.
- **Decision:**
  - Add `email VARCHAR(255) UNIQUE NOT NULL` and `password VARCHAR(255) NOT NULL` to `"Doctor"`.
  - Passwords will be securely hashed using `bcrypt`.
  - On successful login, the API issues a signed JWT containing:
    ```json
    {
      "userId": "<doctor_uuid>",
      "email": "doctor@example.com",
      "role": "DOCTOR"
    }
    ```

### ADR 3: Role-Based Authorization Middleware (`requireRole`)
- **Problem:** [`auth.middleware.ts`](file:///home/rishank/Documents/projects/hospital-flow/apps/api/src/middleware/auth.middleware.ts) currently stubs `requireRole` with a `501` response, blocking all role-protected routes.
- **Decision:**
  - Implement `requireRole(role: string)` to inspect `request.tokenPayload.role`.
  - Enforce `401 Unauthorized` if unauthenticated and `403 Forbidden` if the role is mismatched.
  - Support `role === "PATIENT" || role === "USER"` for patient routes to support registered user accounts.

### ADR 4: Schema Additions for Consultations, Prescriptions & Investigations
- **Problem:** Routes exist for consultations, prescriptions, and investigation orders/reports, but no underlying database tables were defined.
- **Decision:**
  - Introduce `"Consultation"` table:
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE`
    - `patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE`
    - `appointment_id UUID REFERENCES "Appointment"(id) ON DELETE SET NULL`
    - `diagnosis TEXT NOT NULL`
    - `notes TEXT`
    - `treatment_plan TEXT`
    - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
    - `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
  - Introduce `"Prescription"` table:
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `consultation_id UUID REFERENCES "Consultation"(id) ON DELETE SET NULL`
    - `patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE`
    - `doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE`
    - `medication VARCHAR(255) NOT NULL`
    - `dosage VARCHAR(255) NOT NULL`
    - `frequency VARCHAR(100)`
    - `duration VARCHAR(100)`
    - `instructions TEXT`
    - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
  - Introduce `"InvestigationOrder"` table:
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE`
    - `doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE`
    - `test_name VARCHAR(255) NOT NULL`
    - `instructions TEXT`
    - `status VARCHAR(50) DEFAULT 'PENDING'`
    - `result TEXT`
    - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
    - `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### ADR 5: Semantic HTTP Error Handling (`AppError`)
- **Problem:** Any error thrown outside of `ZodError` defaulted to `500 Internal Server Error`.
- **Decision:**
  - Introduce an `AppError` class extending `Error` with `statusCode: number`.
  - Services and controllers throw explicit `AppError` instances (e.g., 404 for missing records, 409 for appointment conflicts).
  - Update [`errorHandler.ts`](file:///home/rishank/Documents/projects/hospital-flow/apps/api/src/utils/errorHandler.ts) to handle `AppError` and respond with the appropriate HTTP status code.

---

## 3. Module & Endpoint Specifications

### Patient Endpoints (`/patients`)
| Method | Route | Middleware | Controller Handler | Description |
|---|---|---|---|---|
| `GET` | `/patients/me` | `authenticate, requireRole("PATIENT")` | `getMyProfile` | Retrieve current patient's profile |
| `PATCH` | `/patients/me` | `authenticate, requireRole("PATIENT")` | `updateMyProfile` | Update patient profile details |
| `GET` | `/patients/me/appointments` | `authenticate, requireRole("PATIENT")` | `getMyAppointments` | Retrieve booked appointments with doctor info |
| `POST` | `/patients/appointments` | `authenticate, requireRole("PATIENT")` | `bookAppointment` | Book an appointment with a doctor |
| `DELETE` | `/patients/appointments/:appointmentId` | `authenticate, requireRole("PATIENT")` | `cancelAppointment` | Cancel an existing appointment |
| `GET` | `/patients/me/journey` | `authenticate, requireRole("PATIENT")` | `getMyJourney` | Retrieve chronological timeline of patient events |
| `GET` | `/patients/me/consultations` | `authenticate, requireRole("PATIENT")` | `getMyConsultations` | Retrieve patient's past consultations & prescriptions |
| `GET` | `/patients/me/reports` | `authenticate, requireRole("PATIENT")` | `getMyReports` | Retrieve investigation / lab reports |
| `GET` | `/patients/me/prescriptions` | `authenticate, requireRole("PATIENT")` | `getMyPrescriptions` | Retrieve prescriptions |
| `GET` | `/patients/me/queue` | `authenticate, requireRole("PATIENT")` | `getMyQueueStatus` | **Untouched** (`501 Not Implemented`) |

### Doctor Endpoints (`/doctors`)
| Method | Route | Middleware | Controller Handler | Description |
|---|---|---|---|---|
| `POST` | `/doctors/login` | None | `login` | Authenticate doctor with email & password |
| `GET` | `/doctors/me` | `authenticate, requireRole("DOCTOR")` | `getMyProfile` | Retrieve logged-in doctor profile |
| `PATCH` | `/doctors/me` | `authenticate, requireRole("DOCTOR")` | `updateMyProfile` | Update doctor profile details |
| `GET` | `/doctors/me/schedule` | `authenticate, requireRole("DOCTOR")` | `getMySchedule` | Retrieve doctor's scheduled appointments |
| `GET` | `/doctors/me/patients` | `authenticate, requireRole("DOCTOR")` | `getMyPatients` | List patients assigned to or seen by doctor |
| `GET` | `/doctors/patients/:patientId` | `authenticate, requireRole("DOCTOR")` | `getPatient` | Retrieve specific patient's medical history |
| `POST` | `/doctors/patients/:patientId/consultation` | `authenticate, requireRole("DOCTOR")` | `createConsultation` | Create consultation & optional prescriptions |
| `PATCH` | `/doctors/consultations/:consultationId` | `authenticate, requireRole("DOCTOR")` | `updateConsultation` | Update diagnosis, notes, treatment plan |
| `POST` | `/doctors/patients/:patientId/orders` | `authenticate, requireRole("DOCTOR")` | `createInvestigationOrder` | Order diagnostic / lab tests |
| `GET` | `/doctors/patients/:patientId/reports` | `authenticate, requireRole("DOCTOR")` | `getPatientReports` | Retrieve patient investigation reports |
| `GET` | `/doctors/me/queue` | `authenticate, requireRole("DOCTOR")` | `getMyQueue` | **Untouched** (`501 Not Implemented`) |
| `POST` | `/doctors/queue/:queueEntryId/complete` | `authenticate, requireRole("DOCTOR")` | `completeQueueEntry` | **Untouched** (`501 Not Implemented`) |
| `POST` | `/doctors/queue/:queueEntryId/skip` | `authenticate, requireRole("DOCTOR")` | `skipQueueEntry` | **Untouched** (`501 Not Implemented`) |

---

## 4. Verification Plan

1. **Automated Testing:**
   - Add integration tests verifying doctor authentication, appointment scheduling, consultation creation, and patient record retrieval.
   - Run Vitest: `npx vitest run`.
2. **Type Safety & Linting:**
   - Ensure strict TypeScript compilation with zero errors: `npx tsc --noEmit`.
3. **Manual Verification:**
   - Seed test doctor and patient records.
   - Verify JWT issuance, authentication gates, and response formats against documentation in `docs/api.md`.
