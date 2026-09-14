# MediQ API AI Instructions

Read the root `PROJECT.md` and `AI-INSTRUCTIONS.md` first. These rules are API-specific.

## API architecture

Use:

`route → middleware → controller → service → database`

Controller responsibilities:

- receive HTTP request;
- validate/parse external input with Zod;
- call service;
- map the service result to an HTTP response.

Service responsibilities:

- business rules;
- authorization that depends on domain state;
- transactions;
- queue logic;
- workflow transitions;
- creation/unblocking of downstream tasks.

## Authentication

- `authenticate` verifies the JWT and sets `request.user`.
- Keep authentication separate from role authorization.
- Keep account role checks separate from staff-role checks.

## Authorization examples

- ADMIN: staff management.
- OPD_MANAGER / authorized reception staff: walk-in registration and routing.
- DOCTOR: consultation and clinical workflow actions.
- LAB_TECH: lab task execution/result publication.
- PHARMACIST: pharmacy processing.
- BILLING_CLERK: cash-counter operations.
- USER: only owned patient-management actions.

Do not assume all `STAFF` accounts have identical permissions.

## Queue rules

Queue ordering must be calculated from current queue state.

Do not write or update a permanent `position` field.

Use priority and queue policy, then joined time as a tie-breaker. Appointment handling must be implemented as explicit business logic, not hidden inside a generic SQL sort that can create unfair behavior.

When the system creates or completes a queue/workflow operation, use a transaction if multiple records must change together.

For future concurrent queue claiming, PostgreSQL row locking such as `FOR UPDATE SKIP LOCKED` may be used where appropriate. Do not introduce it prematurely without a concrete race condition to solve.

## Workflow dependency rules

A task may be `BLOCKED` until all dependencies are complete.

Example:

- LAB_TEST = COMPLETED
- dependent PHARMACY task = becomes WAITING

Dependency resolution must happen atomically with the state transition.

## Appointment rules

- Appointment belongs to a Patient, not directly to a User.
- `booked_by_user_id` identifies the website account that performed the booking.
- Verify the authenticated User is allowed to book for that Patient.
- Prevent conflicting active appointments for the same Doctor.
- Do not expose an exact arrival guarantee when actual queue state is dynamic.

## Patient privacy

A normal User can only access Patient records they own/manage.

Hospital staff access is based on explicit staff authorization and operational need, not merely because the caller is authenticated.

## Database

Prefer the current schema over inventing new abstractions.

Do not add repository layers, ORMs, CQRS, event buses, or background queues unless there is a demonstrated need.

## Realtime

Do not implement WebSockets. Keep state-change logic independent of the eventual transport.
