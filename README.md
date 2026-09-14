# MediQ

**Smarter Queues. Smoother Journeys.**

MediQ is a smart hospital patient-flow and workflow orchestration platform designed to coordinate the movement of patients through OPD, doctor consultations, diagnostics, pharmacy, and billing.

Instead of treating every department as an isolated queue, MediQ connects the patient's journey and turns decisions made in one department into actionable work for the next department.

> **Project scope:** MediQ is a patient-flow/workflow system for a single hospital. It is not intended to be a complete Hospital Management System (HMS).

---

## Table of Contents

- [Problem](#problem)
- [What MediQ Does](#what-mediq-does)
- [Core Patient Journey](#core-patient-journey)
- [Key Features](#key-features)
- [Roles and Access](#roles-and-access)
- [Architecture](#architecture)
- [Backend Structure](#backend-structure)
- [Frontend Structure](#frontend-structure)
- [Database Model](#database-model)
- [Dynamic Queues and ETA](#dynamic-queues-and-eta)
- [Workflow Dependencies](#workflow-dependencies)
- [Simulation / Demo System](#simulation--demo-system)
- [Technology Stack](#technology-stack)
- [Development Principles](#development-principles)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Project Status](#project-status)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## Problem

Hospital OPD workflows often involve several departments working on the same patient, but the handoff between those departments can be fragmented.

A typical patient may need to:

1. Register at OPD.
2. Wait for a doctor.
3. Complete a consultation.
4. Go to the laboratory if tests are prescribed.
5. Return for doctor review when the report is available.
6. Collect medicines from the dispensary.
7. Pay the bill online or at a cash counter.

When these stages are managed independently, patients have limited visibility into what happens next, staff have to coordinate manually, and queues can become difficult to understand.

MediQ focuses on this **patient-flow problem** rather than trying to replace an entire hospital information system.

---

## What MediQ Does

MediQ connects hospital workflow stages around a patient's **Visit**.

The system can:

- Register walk-in patients through an OPD Manager.
- Assign a patient to an appropriate doctor.
- Merge walk-ins and online appointments into a dynamic doctor queue.
- Estimate waiting times instead of treating appointment times as guaranteed service times.
- Let doctors call, inspect, skip, and complete patients from their queue.
- Convert consultation decisions into downstream workflow tasks.
- Send investigation orders to the laboratory queue.
- Keep pharmacy work blocked when a required investigation must be completed first.
- Publish laboratory results for authorized patients and doctors.
- Add prescriptions to the pharmacy workflow.
- Generate billing work after required services are completed.
- Route patients to online payment or a cash-counter queue.
- Track the patient's journey through the system.
- Provide a simulation environment for demonstrating and testing the workflow.

---

## Core Patient Journey

MediQ does **not** assume that every patient follows the same linear path.

A simplified journey is:

```text
                     ┌───────────────┐
                     │      OPD      │
                     │ Registration  │
                     └───────┬───────┘
                             │
                       Doctor Assignment
                             │
                             ▼
                     ┌───────────────┐
                     │ Doctor Queue  │
                     └───────┬───────┘
                             │
                             ▼
                     ┌───────────────┐
                     │ Consultation │
                     └───────┬───────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
           Medicine        Lab            Both
              │              │              │
              ▼              ▼              ▼
         Pharmacy          Lab             Lab
              │              │              │
              │              ▼              │
              │           Report            │
              │              │              │
              │              ▼              │
              │       Doctor Review         │
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                          Billing
                          /     \
                       Online   Cash
                         QR     Counter
```

The actual path depends on what the doctor orders and on workflow dependencies.

---

## Key Features

### 1. Unified Authentication

All website users authenticate through a single login system and a single `users` table.

The backend returns the user's account role and, for staff accounts, the staff role. The frontend then routes the user to the appropriate portal.

There are no separate login pages for patients, doctors, staff, or administrators.

### 2. Patient Accounts and Profiles

A website `USER` is an account that can manage zero or more patient profiles.

Example:

```text
User Account
├── Self
├── Mother
├── Father
└── Child
```

The `Patient` is the person receiving healthcare; the `User` is the website account that manages patient information and bookings.

A walk-in patient may also be registered by hospital staff without having a website account.

### 3. OPD Walk-in Registration

An OPD Manager can:

- Register a walk-in patient.
- Collect patient details and mobile number.
- Select the department.
- Assign a doctor.
- Create the visit.
- Place the patient into the appropriate doctor queue.

Messaging/SMS/WhatsApp is intentionally not part of the current implementation, but the patient's mobile number is retained for future use.

### 4. Dynamic Doctor Queue

Doctor queues can contain both:

- Walk-ins.
- Online appointments.
- Follow-up visits.

The queue is dynamic rather than a fixed list. Queue position and estimated waiting time are derived from current database state and doctor workload.

ETA is treated as an **estimate**, not a guaranteed consultation time.

### 5. Doctor Workflow

Doctors can:

- View their queue.
- Call the next patient.
- Skip a patient who is unavailable.
- Start a consultation.
- Record diagnosis, notes, and treatment plans.
- Prescribe medicines.
- Request investigations.
- Complete the consultation.
- Access relevant reports.

### 6. Workflow Orchestration

A doctor's decision can automatically create downstream work.

For example:

```text
Consultation
    │
    ├── Blood Test → Lab Queue
    │
    └── Medicine   → Pharmacy Queue
```

If the prescription depends on a lab result:

```text
Lab Test
   ↓
Report Ready
   ↓
Pharmacy Task Unlocked
```

This dependency-based approach is central to MediQ.

### 7. Laboratory Workflow

The laboratory can process an investigation through stages such as:

```text
Investigation Order
        ↓
Lab Queue
        ↓
Sample Collected
        ↓
Processing
        ↓
Result
        ↓
Report Available
```

Patients can see available reports, and authorized doctors can access them during follow-up care.

### 8. Pharmacy Workflow

A prescription can create pharmacy work:

```text
Prescription
    ↓
Pharmacy Queue
    ↓
Dispense
    ↓
Completed
```

The pharmacy workflow must respect any upstream dependency, such as a required diagnostic result.

### 9. Billing and Payments

Billing supports two intended payment paths:

```text
Invoice
├── Online Payment → QR / payment flow
└── Cash           → Cash Counter Queue
```

The application models payment state, while real payment-provider integration is intentionally outside the current MVP unless explicitly added later.

### 10. Notifications

MediQ can maintain notification records for events such as:

- Queue updates.
- Patient being called.
- Lab report availability.
- Pharmacy readiness.
- Payment status.

External SMS/WhatsApp delivery is not part of the current implementation.

---

## Roles and Access

### Account Roles

| Role | Purpose |
|---|---|
| `USER` | Website account that can manage patient profiles and book appointments. |
| `STAFF` | Hospital account with a staff profile and staff-specific role. |
| `ADMIN` | Privileged account that creates and manages hospital staff. |

### Staff Roles

| Staff Role | Main Responsibility |
|---|---|
| `DOCTOR` | Doctor queue, consultation, investigations, prescriptions, reports. |
| `OPD_MANAGER` | Walk-in registration, doctor assignment, OPD workflow. |
| `LAB_TECH` | Laboratory queue, samples, results, reports. |
| `PHARMACIST` | Pharmacy queue and medicine dispensing. |
| `BILLING_CLERK` | Billing and cash-counter workflow. |
| `NURSE` | Reserved for future role-specific workflow. |
| `RECEPTIONIST` | Reserved for future role-specific workflow. |

The separation between account role and staff role is intentional:

```text
User Account
    └── STAFF
          └── staff_role = DOCTOR
```

A Doctor is therefore a staff specialization, not a separate authentication system.

---

## Architecture

MediQ currently uses a **modular monolith**.

```text
                         React / TypeScript
                                │
                              REST
                                │
                                ▼
                       Node.js / Express
                                │
                ┌───────────────┴───────────────┐
                │                               │
           Middleware                       Modules
                │                               │
         Authentication                 Controller
         Authorization                        ↓
                                         Service
                                             ↓
                                        PostgreSQL
```

The normal backend flow is:

```text
Request
 → Authentication
 → Authorization
 → Route
 → Controller
 → Service
 → PostgreSQL
```

Controllers remain thin; business rules live in services.

The database is the source of truth for workflow state.

---

## Backend Structure

Backend modules follow this pattern:

```text
apps/api/src/modules/
└── <module>/
    ├── <module>.route.ts
    ├── <module>.schema.ts
    ├── <module>.controller.ts
    ├── <module>.service.ts
    └── <module>.types.ts
```

Responsibilities:

- **Route:** endpoint definitions and middleware.
- **Schema:** Zod validation at the HTTP boundary.
- **Controller:** HTTP handling and response formatting.
- **Service:** business rules, authorization that depends on domain ownership, transactions, and workflow transitions.
- **Types:** TypeScript domain/API types.

The project intentionally avoids unnecessary layers such as repositories, managers, factories, or microservices unless they become necessary.

---

## Frontend Structure

The frontend is React + TypeScript and uses a shared authentication/session model.

A role-aware application is presented after login:

```text
/login
   │
   └── backend returns role
           │
           ├── USER → User / Patient portal
           ├── ADMIN → Admin portal
           └── STAFF
                 ├── DOCTOR → Doctor portal
                 ├── OPD_MANAGER → OPD portal
                 ├── LAB_TECH → Lab portal
                 ├── PHARMACIST → Pharmacy portal
                 └── BILLING_CLERK → Billing portal
```

Frontend route guards are for navigation and user experience only. The backend remains responsible for real authorization and access control.

---

## Database Model

The database centers the patient encounter around `visits`.

A simplified model is:

```text
users
├── patient_profiles
└── staff_profiles
      └── doctors

users / patients
      │
      └── appointments
              │
              ▼
            visits
              │
      ┌───────┼────────┬───────────────┐
      ▼       ▼        ▼               ▼
    queue  consultation investigations prescriptions
                                      │
                                      ▼
                                  pharmacy
              │
              ▼
           billing
              │
              ▼
           payments
```

The schema also supports workflow tasks/dependencies, notifications, and the shared queue model required by the current workflow.

The database schema in `apps/api/src/database/projectSchema.ts` is the authoritative application schema.

---

## Dynamic Queues and ETA

MediQ uses a shared queue concept instead of maintaining unrelated queue implementations for every department.

Typical queue destinations include:

- OPD.
- Laboratory.
- Pharmacy.
- Cash counter.

Queue state includes information such as:

- Patient/visit.
- Department.
- Doctor where applicable.
- Queue type/source.
- Priority.
- Status.
- Token.
- Join time.
- Called/start/completion timestamps.

The frontend should not locally invent queue positions. It reads current server state and displays estimates derived from it.

A simple ETA model may use a doctor's average consultation duration and the number/priority of patients ahead. More advanced estimation can be introduced later.

---

## Workflow Dependencies

MediQ uses workflow tasks and dependencies because a hospital journey is not always linear.

For example:

```text
                    Consultation
                         │
               ┌─────────┴─────────┐
               │                   │
            Blood Test          Medicine
               │                   │
               ▼                   │
              LAB                  │
               │                   │
               ▼                   │
             REPORT ────────────────┘
               │
               ▼
        Pharmacy Unblocked
```

This means a patient can be:

- Waiting in the laboratory.
- Blocked from pharmacy because a required test is not complete.
- Ready for billing while another patient is still in diagnostics.

The system therefore models **work and dependencies**, not just one global patient status.

---

## Simulation / Demo System

MediQ includes a planned/active frontend-only simulation environment intended for demonstrations, integration testing, and workflow experimentation.

The simulator is designed to operate as a workload generator against the real MediQ APIs.

```text
Scenario JSON
     ↓
Simulation Engine
     ↓
Event Scheduler
     ↓
Real REST API
     ↓
MediQ Backend
     ↓
PostgreSQL
```

The simulator can generate:

- Walk-in patients.
- Online appointments.
- Doctors and staff actors.
- Dynamic arrival times.
- Consultation durations.
- Lab/pharmacy branching.
- Billing flows.

It uses a central event scheduler with simulated time and configurable speed instead of scattering timers throughout the UI.

### Simulation Display Modes

**Log Mode** focuses on technical execution:

```text
Actor
→ HTTP method
→ Endpoint
→ Response status
→ Response time
→ Workflow event
```

**GUI Mode** focuses on hospital operations:

- Schematic hospital map.
- Patients per department.
- Queue sizes.
- Average wait times.
- Active consultations.
- Patient journeys.
- Bottleneck department.
- Overall journey metrics.

The simulation is deliberately frontend-only. It does not create a second backend workflow or directly modify PostgreSQL.

---

## Technology Stack

### Backend

- TypeScript
- Node.js
- Express
- PostgreSQL
- Zod
- JWT-based authentication

### Frontend

- React
- TypeScript
- Vite

### Development

- Git / GitHub
- Automated tests
- Docker / local development tooling where applicable

### Planned Real-Time Layer

WebSockets are planned for real-time queue/notification delivery, but the current implementation keeps the core business logic independent of WebSockets.

---

## Development Principles

### Database First

The database is the source of truth for patient, queue, workflow, and payment state.

### Business Logic in Services

Controllers handle HTTP concerns. Services own domain rules and state transitions.

### Validate at the Boundary

Zod validates incoming API data before business logic runs.

### Backend Authorization Is Mandatory

Frontend route protection improves UX, but all real permissions are enforced on the backend.

### Don't Overbuild

MediQ intentionally avoids unrelated HMS functionality, multi-tenancy, microservices, and infrastructure that is not required by the current problem.

### Build Vertical Slices

Features should be built and tested as complete workflow slices rather than creating disconnected screens first.

### WebSockets Are Separate

The real-time communication layer is intentionally kept separate so it can be implemented and learned independently without coupling it to core business logic.

---

## Getting Started

The exact scripts depend on the current repository configuration. The typical development setup is:

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Install dependencies

Install dependencies for the API and web applications using the package managers/scripts already defined in the repository.

```bash
cd apps/api
npm install

cd ../web
npm install
```

### 3. Configure environment variables

Configure the environment variables required by the API, including the PostgreSQL connection string and JWT configuration.

Do not commit secrets to Git.

### 4. Start PostgreSQL

Use the repository's configured Docker/local PostgreSQL setup.

### 5. Start the API

Use the scripts defined in `apps/api/package.json`.

### 6. Start the frontend

Use the scripts defined in `apps/web/package.json`.

The normal development flow is:

```text
Frontend
   ↓
REST API
   ↓
PostgreSQL
```

---

## Testing

Testing should focus on business-critical behavior first.

Important cases include:

- Authentication.
- Authorization.
- Patient ownership.
- Staff permissions.
- Appointment conflicts.
- Queue ordering and transitions.
- Doctor actions.
- Workflow dependencies.
- Lab completion.
- Pharmacy unlocking/dispensing.
- Billing and payments.

A feature should be considered complete only after relevant tests and TypeScript/build checks pass.

---

## Project Status

MediQ is under active development.

Current development priorities are organized around vertical workflow slices:

```text
Unified authentication / authorization
          ↓
Admin staff management
          ↓
OPD walk-in registration
          ↓
Doctor assignment
          ↓
Dynamic doctor queue
          ↓
Doctor consultation
          ↓
Workflow dependencies
          ↓
Laboratory
          ↓
Pharmacy
          ↓
Billing / payment
          ↓
Patient portal
          ↓
Online appointments
          ↓
Notifications
          ↓
WebSockets / real-time delivery
```

The implementation status is tracked separately in `STATUS.md`.

---

## Roadmap

### Current MVP

- [ ] Unified login and session handling.
- [ ] Backend authorization.
- [ ] Admin staff management.
- [ ] OPD Manager walk-in registration.
- [ ] Doctor assignment.
- [ ] Dynamic doctor queues.
- [ ] Online appointment flow.
- [ ] Doctor consultation workflow.
- [ ] Lab queue and reports.
- [ ] Pharmacy queue and dispensing.
- [ ] Billing and cash-counter flow.
- [ ] Patient journey/dashboard.
- [ ] Notification records.
- [ ] Frontend simulation/demo mode.

### Later

- [ ] WebSocket-based live updates.
- [ ] External SMS/WhatsApp delivery.
- [ ] Real payment-provider integration.
- [ ] More advanced ETA estimation.
- [ ] More detailed operational analytics.

---

## Contributing

When developing MediQ:

1. Read `PROJECT.md` and the AI/development instructions before making architectural changes.
2. Inspect existing code before creating new files.
3. Keep modules focused.
4. Avoid duplicating existing functionality.
5. Write tests for important business rules.
6. Keep commits small and meaningful.
7. Do not change the database architecture casually.
8. Do not introduce multi-hospital or unrelated HMS functionality unless the scope explicitly changes.

---

## Team / Project

**MediQ — Smart Hospital Patient-Flow and Workflow Orchestration**

Built for **Smart India Hackathon 2026**.
