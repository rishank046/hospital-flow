# MediQ - Architecture & Domain Model

**Smart India Hackathon (SIH 2026)** — Intra-University Hackathon Project  
**System Name:** MediQ (Smart Hospital Patient-Flow and Workflow Orchestration System)

---

## 1. System Overview

MediQ is a specialized hospital patient-flow and clinical workflow orchestration system. MediQ does not aim to replace an entire legacy Hospital Information System (HIS/HMS). Instead, it coordinates patient movement across clinical stages:

$$\text{Registration} \longrightarrow \text{OPD / Doctor Triage} \longrightarrow \text{Diagnostics / Lab} \longrightarrow \text{Doctor Review} \longrightarrow \text{Pharmacy} \longrightarrow \text{Billing}$$

### Single Hospital Scope
MediQ currently manages a **single hospital facility**. Multi-tenancy, multi-branch hierarchies, or `hospital_id` columns are deliberately excluded to preserve architectural clarity and keep the codebase focused on patient flow and clinical orchestration.

### Architectural Simplicity: REST as Single Source of Truth
Real-time layers (WebSockets, Socket.io) are **strictly deferred**. All queue coordination, consultation progress, and status transitions operate reliably over HTTP REST APIs backed by PostgreSQL with ACID transactions. Existing socket stubs remain dormant and uncoupled.

---

## 2. Core Domain Model & Hierarchies

### 2.1 Account & Identity Layer

```
                        ┌────────────────────────┐
                        │      User (Account)    │
                        │  id, email, password   │
                        │  role: USER|STAFF|ADMIN│
                        └───────────┬────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │        Patient        │                 │         Staff         │
   │ id, name, age, gender │                 │ id, employee_code     │
   │ owner_user_id ────────┤                 │ role: DOCTOR|NURSE... │
   │ (1 User -> N Patients)│                 │ user_id (1:1 with User│
   └───────────────────────┘                 └───────────┬───────────┘
                                                         │ (role = 'DOCTOR')
                                                         ▼
                                             ┌───────────────────────┐
                                             │        Doctor         │
                                             │ id, specialization    │
                                             │ staff_id (FK -> Staff)│
                                             │ department_id (FK)    │
                                             └───────────────────────┘
```

#### Entities Breakdown:
1. **`User` (Account & Credentials):**
   - Central authentication identity for every human interacting with the system.
   - Holds credentials (`email`, `password` hashed with `bcrypt`) and top-level `role` (`USER`, `STAFF`, `ADMIN`).
2. **`Patient` (Managed Clinical Profiles):**
   - Represents a clinical profile. A single `User` account can create and manage multiple `Patient` records (e.g., self, child, elderly parent) via `owner_user_id`.
   - Access control strictly guarantees that patients can only be accessed or modified by their profile owner (`owner_user_id === req.user.userId`) or authorized medical staff.
3. **`Staff` (Hospital Membership):**
   - Represents staff employment at the hospital. Links 1:1 to a `User` record via `user_id`.
   - Distinguishes hospital functions via `role` (`DOCTOR`, `NURSE`, `RECEPTIONIST`, `LAB_STAFF`, `PHARMACIST`) and status (`ACTIVE`, `INACTIVE`, `ON_LEAVE`).
4. **`Doctor` (Clinical Specialist Profile):**
   - Contains doctor-specific medical information: `specialization`, `license_number`, consultation fees, and working hours.
   - Links to `Staff` via `staff_id` and to `Department` via `department_id`.
   - Non-doctor staff members (e.g., nurses, receptionists) have a `Staff` record but **no** `Doctor` record and cannot access doctor clinical consultation APIs.
5. **`Department` (Hospital Clinical Units):**
   - Categorizes clinical specialties (e.g., Cardiology, General Medicine, Pediatrics, Radiology).

---

## 3. Queue Architecture & State Machine

MediQ features a unified `QueueEntry` model that unifies scheduled appointments, walk-in patients, and emergency arrivals under a single priority-driven orchestration engine.

### 3.1 Queue Entry Lifecycle

```
    [ APPOINTMENT / WALK_IN / EMERGENCY ]
                     │
                     ▼
                 (WAITING)
                     │
         Doctor calls next patient
                     ▼
                  (CALLED)
                     │
         Doctor initiates consultation
                     ▼
                 (SERVING)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   (COMPLETED)                (SKIPPED)
```

### 3.2 Dynamic Prioritization
Queue positions are calculated deterministically:
$$\text{ORDER BY } \text{priority DESC}, \text{joined\_at ASC}$$

- **EMERGENCY:** High priority (e.g., 10+), moves immediately to the front of the queue.
- **APPOINTMENT:** Medium priority (e.g., 5), ordered by appointment time slot.
- **WALK_IN:** Standard priority (e.g., 1), ordered strictly by arrival timestamp (`joined_at`).

Doctors invoke `/queue/doctor/call-next` to transition the highest-priority patient from `WAITING` to `CALLED`, followed by `/queue/:id/start` (`SERVING`), and finally mark consultations as `COMPLETED` or `SKIPPED`.

---

## 4. Frontend Architecture & Role-Based Routing

The frontend (`apps/web`) is structured with clear role segregation:

| Role | Accessible Views | Default Redirect |
|---|---|---|
| `USER` | Patient Dashboard, Appointment Booking, Medical Records, Queue Status | `/patient/dashboard` |
| `STAFF` (`role = 'DOCTOR'`) | Doctor Dashboard, Daily Schedule, Assigned Patients, Clinical Consultations, Active Queue | `/doctor/dashboard` |
| `STAFF` (Other staff roles) | Staff Portal, Departmental Workflow, Patient Check-in, Queue Monitor | `/staff` |
| `ADMIN` | Admin Portal, Doctor & Staff Management, Department Roster, System Monitoring | `/admin` |

### Design Standards
- Clean hospital portal interface utilizing design tokens.
- **Zero emojis in UI:** Navigation links, empty states, badges, and buttons use clean SVG and unicode icons (`◷`, `Rx`, `≡`, `◎`, `◈`, `⌕`).
