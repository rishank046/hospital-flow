# AI INSTRUCTIONS — HOSPITAL FLOW FRONTEND (`apps/web`)

> **CRITICAL DIRECTIVE FOR AI ASSISTANTS & AGENTS**:  
> You are acting as a Senior Frontend Architect and React/TypeScript Engineer on the **Hospital Flow Web Application**.  
> You must strictly adhere to the modular architecture, directory structure, security requirements, and UI conventions defined in this document.  
> **DO NOT generate monolithic single-file code or put all logic into `App.tsx`.**  
> **DO NOT make direct `fetch` calls inside components without using the service layer.**  
> **DO NOT hardcode API URLs or secrets.**  
> **DO NOT compromise client-side security, authentication guards, or XSS protections.**

---

## 1. Project Overview & Tech Stack

Hospital Flow Web is the clinical frontend interface serving two distinct roles:
1. **Patient Portal:** Authentication, profile management, appointment booking/cancellation, journey timeline, prescriptions, consultations, and lab reports.
2. **Doctor Portal:** Doctor authentication, daily appointment schedules, assigned patient roster, patient medical history, creating consultations, issuing prescriptions, and ordering laboratory investigations.

### Technology Stack
- **Framework:** React 19 (`react@^19.2.8`, `react-dom@^19.2.8`)
- **Build Tool:** Vite (`vite@^8.x`)
- **Language:** TypeScript (`verbatimModuleSyntax: true`, `moduleResolution: "bundler"`, `noUnusedLocals: true`)
- **State Management:** React Context (`AuthContext`) + Custom Hooks
- **Styling:** CSS Modules / Vanilla CSS / Modern Utility Classes
- **Linter:** ESLint (`eslint@^10.x`)

---

## 2. Strict Modular File Structure (NO MONOLITHIC App.tsx)

AI assistants frequently dump forms, modals, tables, and state directly into `App.tsx`.  
**This is strictly prohibited.** `App.tsx` must only handle routing and top-level providers.

### Target Directory Layout
```text
apps/web/src/
├── main.tsx                    # ReactDOM root mounting ONLY
├── App.tsx                     # Top-level Router & Provider wrapper ONLY
├── App.css                     # App shell layout styles
├── index.css                   # Global resets, design tokens, typography
├── assets/                     # Logos, static illustrations, icons
│
├── types/                      # TypeScript contracts matching backend models
│   ├── api.types.ts            # ApiResponse, ApiError, RequestOptions
│   ├── auth.types.ts           # AuthUser, LoginCredentials, RegisterPayload, AuthTokenResponse
│   ├── patient.types.ts        # PatientProfile, Appointment, JourneyEvent, Prescription, Report
│   └── doctor.types.ts         # DoctorProfile, ScheduleItem, Consultation, InvestigationOrder
│
├── services/                   # Centralized API Client Layer (Fetch & Contracts)
│   ├── api.client.ts           # Base HTTP client (baseURL, auth headers, 401 handling)
│   ├── auth.service.ts         # /auth/* & /doctors/login endpoints
│   ├── patient.service.ts      # /patients/* endpoints
│   └── doctor.service.ts       # /doctors/* endpoints
│
├── context/                    # Application-wide React Contexts
│   └── AuthContext.tsx         # Auth state, login(), logout(), user profile, token persistence
│
├── hooks/                      # Custom Reusable React Hooks
│   ├── useAuth.ts              # Easy access to AuthContext
│   ├── useAppointments.ts      # Appointment fetching, booking, and cancellation
│   ├── usePatientJourney.ts    # Chronological patient journey timeline
│   └── useDoctorSchedule.ts    # Doctor daily schedule and status updates
│
├── components/                 # Pure & Composable UI Components
│   ├── common/                 # Reusable design system primitives
│   │   ├── Button.tsx          # Variants: primary, secondary, danger, outline
│   │   ├── Input.tsx           # Controlled input with label & error text
│   │   ├── Card.tsx            # Container card with header, body, footer
│   │   ├── Modal.tsx           # Accessible dialog backdrop & escape handling
│   │   ├── Spinner.tsx         # Loading state indicator
│   │   ├── Alert.tsx           # Status banners: info, success, warning, error
│   │   └── Badge.tsx           # Status indicators (e.g. "Pending", "Completed")
│   ├── layout/                 # Layout framing & navigation
│   │   ├── Navbar.tsx          # Top navigation, user greeting, logout button
│   │   ├── Sidebar.tsx         # Role-specific navigation links
│   │   ├── ProtectedRoute.tsx  # Auth guard & Role-Based Access Control gate
│   │   └── DashboardLayout.tsx # Main dashboard frame (Sidebar + Navbar + Page)
│   ├── patient/                # Patient domain components
│   │   ├── AppointmentList.tsx # List and filter patient appointments
│   │   ├── BookAppointmentModal.tsx # Doctor selection and datetime picker
│   │   ├── JourneyTimeline.tsx # Timeline visualization of patient flow
│   │   ├── PrescriptionCard.tsx# Medication, dosage, and doctor instructions
│   │   └── ReportViewer.tsx    # Lab results and test summaries
│   └── doctor/                 # Doctor domain components
│       ├── ScheduleView.tsx    # Today's appointments with patient links
│       ├── PatientHistory.tsx  # Past visits, prescriptions, and diagnoses
│       ├── ConsultationModal.tsx # Diagnosis, treatment plan, and prescription builder
│       └── OrderLabTestModal.tsx # Investigation orders for patient
│
└── pages/                      # Route-level views (compose components & hooks)
    ├── auth/
    │   ├── LoginPage.tsx       # Dual or patient login view
    │   ├── RegisterPage.tsx    # Patient registration view
    │   └── DoctorLoginPage.tsx # Dedicated doctor login view
    ├── patient/
    │   ├── PatientDashboard.tsx
    │   ├── PatientAppointmentsPage.tsx
    │   ├── PatientJourneyPage.tsx
    │   ├── PatientMedicalRecordsPage.tsx
    │   └── PatientProfilePage.tsx
    ├── doctor/
    │   ├── DoctorDashboard.tsx
    │   ├── DoctorSchedulePage.tsx
    │   ├── DoctorPatientsPage.tsx
    │   └── DoctorPatientDetailPage.tsx
    └── NotFoundPage.tsx        # 404 Fallback page
```

---

## 3. Separation of Concerns & Rules for Each Layer

| Directory | What Belongs Here | What is STRICTLY FORBIDDEN |
| :--- | :--- | :--- |
| `types/` | Pure TypeScript interfaces, type aliases, enums. | NO runtime executable code, NO functions. |
| `services/` | HTTP request wrappers (`fetch`), request serialization, error throwing. | NO React hooks (`useState`, `useEffect`), NO JSX. |
| `context/` | Global authentication state, tokens, user session. | NO page-specific styling or one-off form logic. |
| `hooks/` | Reusable stateful logic, data fetching with loading/error handling. | NO direct JSX/HTML markup returned. |
| `components/` | Visual presentation, user interaction, accessible UI. | NO direct `fetch()` calls; use hooks or services. |
| `pages/` | Assembling components for a specific route. | NO 500-line monolithic scripts. Delegate to child components. |

---

## 4. API Client & Service Standards

All backend communication MUST go through `src/services/api.client.ts`.  
Never write inline `fetch("http://localhost:3000/...")` inside React components.

### 1. Central HTTP Client (`src/services/api.client.ts`)
```ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!BASE_URL) {
    throw new Error("VITE_API_BASE_URL is required");
}

export class ApiError extends Error {
    public status: number;
    public issues?: unknown[];

    constructor(message: string, status: number, issues?: unknown[]) {
        super(message);
        this.status = status;
        this.issues = issues;
        this.name = "ApiError";
    }
}

export async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = localStorage.getItem("auth_token");
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");

    if (token) {
        headers.set("Authorization", "Bearer " + token);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorMessage = "An unexpected error occurred";
        let issues: unknown[] | undefined;
        try {
            const data = await response.json();
            errorMessage = data.message || errorMessage;
            issues = data.errors;
        } catch {
            errorMessage = response.statusText;
        }

        // Automatic session clearance on 401 Unauthorized
        if (response.status === 401) {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_role");
            window.dispatchEvent(new Event("auth:unauthorized"));
        }

        throw new ApiError(errorMessage, response.status, issues);
    }

    // Return empty object for 204 or empty bodies
    if (response.status === 204) {
        return {} as T;
    }

    const responseText = await response.text();
    if (!responseText.trim()) {
        return {} as T;
    }

    return JSON.parse(responseText) as T;
}
```

### 2. Domain Service Example (`src/services/patient.service.ts`)
```ts
import { request } from "./api.client";
import type {
    Appointment,
    BookAppointmentPayload,
    PatientProfile,
    PatientJourneyResponse,
} from "../types/patient.types";

export const patientService = {
    getProfile: () => request<PatientProfile>("/patients/me"),
    
    updateProfile: (data: Partial<PatientProfile>) =>
        request<PatientProfile>("/patients/me", {
            method: "PATCH",
            body: JSON.stringify(data),
        }),

    getAppointments: async () => {
        const data = await request<{ appointments: Appointment[] }>("/patients/me/appointments");
        return data.appointments;
    },

    bookAppointment: (payload: BookAppointmentPayload) =>
        request<Appointment>("/patients/appointments", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    cancelAppointment: (appointmentId: string) =>
        request<{ message: string }>(`/patients/appointments/${appointmentId}`, {
            method: "DELETE",
        }),

    getJourney: () => request<PatientJourneyResponse>("/patients/me/journey"),
};
```

---

## 5. Security & Robustness Rules for Frontend

### A. Route Guards & Role Protection (`ProtectedRoute.tsx`)
Never display sensitive patient or doctor interfaces without checking authentication and role:
```tsx
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles?: Array<"PATIENT" | "DOCTOR" | "ADMIN">;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { isAuthenticated, role, loading } = useAuth();

    if (loading) {
        return <div className="loading-screen">Loading session...</div>;
    }

    if (!isAuthenticated) {
        window.location.href = "/login";
        return null;
    }

    if (allowedRoles && (!role || !allowedRoles.includes(role))) {
        return (
            <div className="forbidden-notice">
                <h2>Access Forbidden (403)</h2>
                <p>Your account ({role ?? "UNKNOWN"}) does not have permission to view this page.</p>
            </div>
        );
    }

    return <>{children}</>;
}
```

### B. Cross-Site Scripting (XSS) Prevention
- **NEVER** use `dangerouslySetInnerHTML`.
- Rely exclusively on React JSX text interpolation `{content}` which escapes HTML entities automatically.
- Sanitize any user-generated URLs before passing to `<a href={url}>`.

### C. Sensitive Information & Logging
- **NEVER** output passwords, tokens, or personal medical information to `console.log`.
- Current implementation stores auth tokens in `localStorage` for session persistence; treat this as a risk tradeoff and clear immediately on logout.
- Prefer HttpOnly secure cookies for hardened deployments.
- Clear authentication state immediately on logout:
  ```ts
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_role");
  ```

### D. Always Handle Three Essential Data States
Every component fetching data MUST explicitly render:
1. **Loading State:** `<Spinner />` or skeleton placeholder.
2. **Error State:** User-friendly alert banner with retry option.
3. **Empty State:** Helpful message when arrays/lists are empty (e.g. "No appointments booked yet.").

---

## 6. Backend API Alignment (From `docs/api.md`)

| Feature | Method | Endpoint | Allowed Role | Key Request Fields |
| :--- | :--- | :--- | :--- | :--- |
| Patient Register | `POST` | `/auth/register` | Public | `name`, `email`, `password` (min 6) |
| Patient Login | `POST` | `/auth/login` | Public | `email`, `password` |
| Doctor Login | `POST` | `/doctors/login` | Public | `email`, `password` |
| Patient Profile | `GET` / `PATCH`| `/patients/me` | `PATIENT` | `name`, `age`, `gender`, `patientType` |
| Book Appointment | `POST` | `/patients/appointments` | `PATIENT` | `doctorId`, `startTime`, `endTime` (ISO) |
| Cancel Appointment| `DELETE` | `/patients/appointments/:id` | `PATIENT` | None |
| Patient Journey | `GET` | `/patients/me/journey` | `PATIENT` | None |
| Doctor Profile | `GET` / `PATCH`| `/doctors/me` | `DOCTOR` | `name`, `specialization`, `department` |
| Doctor Schedule | `GET` | `/doctors/me/schedule` | `DOCTOR` | None |
| Doctor Patients | `GET` | `/doctors/me/patients` | `DOCTOR` | None |
| Patient Detail | `GET` | `/doctors/patients/:patientId` | `DOCTOR` | None |
| Create Consultation| `POST` | `/doctors/patients/:id/consultation`| `DOCTOR` | `diagnosis`, `treatmentPlan`, `prescriptions` |
| Order Lab Test | `POST` | `/doctors/patients/:id/orders` | `DOCTOR` | `testName`, `instructions` |
| Doctor Patient Reports | `GET` | `/doctors/patients/:id/reports` | `DOCTOR` | None |

---

## 7. Verification & Quality Commands

Always test code before opening a PR:

1. **Typecheck & Build Frontend:**
   ```bash
   npm --prefix apps/web run build
   ```
   *Runs `tsc -b && vite build`. Must succeed with 0 compilation errors.*

2. **Lint Code:**
   ```bash
   npm --prefix apps/web run lint
   ```
   *Must pass ESLint without unused variables or bad hooks dependencies.*

3. **Start Development Server:**
   ```bash
   npm --prefix apps/web run dev
   ```

---

## 8. Summary Checklist for AI Generation

When generating frontend code:
- [ ] Is the code split across `components/`, `pages/`, `hooks/`, and `services/`?
- [ ] Has `App.tsx` been kept minimal (routing and providers only)?
- [ ] Are all API calls routed through `src/services/` using `api.client.ts`?
- [ ] Are TypeScript types defined in `src/types/` without using `any`?
- [ ] Is `ProtectedRoute` used to enforce roles (`PATIENT` vs `DOCTOR`)?
- [ ] Are loading, error, and empty states handled?
- [ ] Is `dangerouslySetInnerHTML` avoided?
- [ ] Are passwords and tokens protected from `console.log`?
