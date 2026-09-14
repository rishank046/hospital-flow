# MediQ — Project Contract

## 1. Product

MediQ is a smart hospital patient-flow and workflow orchestration system for a **single hospital**.

MediQ is **not** a full Hospital Management System (HMS). Its job is to coordinate the patient's journey through OPD, doctor consultation, diagnostics, pharmacy, and billing while keeping queues and patient-visible progress synchronized.

The core problem is fragmented patient flow:

- Walk-in patients need to be registered and routed to the right doctor.
- Online appointments must coexist with walk-ins in a dynamic doctor queue.
- Doctors need to make decisions that automatically create downstream work.
- Lab, pharmacy, and billing departments need their own queues without disconnected data.
- Patients need visibility into where they are, what happens next, and estimated waiting time.
- Diagnostic work can be a dependency for later work such as medication.

## 2. MVP workflow

### Walk-in

1. An OPD Manager / authorized reception staff logs in.
2. They register or find the patient.
3. They capture the patient's mobile number for future messaging. Messaging is **not implemented yet**.
4. They choose the appropriate department and doctor.
5. MediQ creates a Visit and an OPD QueueEntry.
6. The doctor sees the dynamic queue.

### Online appointment

1. A website User logs in.
2. The User selects one of the Patient profiles they manage.
3. The User selects a doctor and appointment window.
4. MediQ prevents conflicting appointments for that doctor.
5. The appointment eventually becomes a Visit when checked in / attended.
6. The appointment participates in the same dynamic OPD queue as walk-ins according to queue policy.
7. The patient receives an estimated waiting window rather than an exact guarantee.

### Doctor consultation

The doctor can:

- call the next patient;
- mark a patient as skipped when the patient is unavailable;
- start and complete a consultation;
- write diagnosis/notes/treatment plan;
- prescribe one or more medicines;
- order one or more investigations;
- determine workflow requirements that cause downstream tasks to be created.

The doctor queue must never require a manually persisted permanent position. Queue order is calculated from current state, priority, appointment policy, and joined time.

### Diagnostics

A diagnostic task can be sent to the laboratory queue.

The lab flow is:

`WAITING → SAMPLE_COLLECTED → IN_PROGRESS → COMPLETED`

When the report is completed, the patient can see the report and an authorized doctor can access it.

### Workflow dependencies

A visit is **branching**, not a simple linear pipeline.

Example:

`Consultation → Blood Test → Report → Doctor Review → Pharmacy → Billing`

Another patient may only need:

`Consultation → Pharmacy → Billing`

MediQ therefore uses `workflow_tasks` and task dependencies. A dependent task may remain `BLOCKED` until all required upstream tasks are completed.

### Pharmacy

When a prescription creates pharmacy work:

1. A Pharmacy workflow task is created.
2. It becomes available only when its dependencies are satisfied.
3. A Pharmacy QueueEntry is created.
4. A pharmacist calls the patient.
5. Medicines are dispensed.
6. The pharmacy task is completed.

### Billing

Billing is represented by an Invoice and InvoiceItems.

Payment can be:

- `ONLINE`: provider-facing QR/checkout data may be stored, but payment-provider integration is outside the current MVP.
- `CASH`: the patient is sent to the Cash Counter queue.

Successful payment state must be determined by backend records, never trusted from the browser.

## 3. Identity model

### User

`User` means a website account.

A User is **not automatically a patient**.

One User can manage zero or many Patient profiles.

Examples:

- one account manages self;
- one account manages self + mother + father;
- one account may exist before any patient profile is created.

### Patient

`Patient` is the person receiving healthcare.

A Patient may:

- belong to a website User (`owner_user_id`);
- be a walk-in patient registered by OPD staff without a website account (`owner_user_id = NULL`);
- have a mobile number stored for future messaging.

### Staff

Staff uses the same `users` table and the same login page.

`users.role = STAFF` identifies the account as hospital staff.

`staff_profiles.staff_role` identifies what that staff member does.

Current staff roles:

- `DOCTOR`
- `OPD_MANAGER`
- `NURSE`
- `PHARMACIST`
- `LAB_TECH`
- `RECEPTIONIST`
- `BILLING_CLERK`

### Admin

Admin also uses the same `users` table and same login page.

`users.role = ADMIN` is a privileged application role.

Admin responsibilities include creating and managing hospital staff accounts and staff assignments.

ADMIN does not need a `staff_profile` unless a future product requirement explicitly makes an admin also a hospital worker.

## 4. Authorization rules

Authentication answers **who are you?**

Authorization answers **what are you allowed to do?**

Examples:

- `ADMIN` can create/deactivate/manage staff.
- `OPD_MANAGER` can register walk-ins and route them to doctors.
- `DOCTOR` can manage consultations and clinical downstream orders.
- `LAB_TECH` can perform lab workflow tasks and publish results according to permissions.
- `PHARMACIST` can process pharmacy tasks and dispense prescriptions.
- `BILLING_CLERK` can process cash billing operations.
- normal `USER` can manage only patient profiles they own and book appointments for those patients.

Backend authorization is mandatory. Frontend route guards are only for UX and navigation.

## 5. Domain model

The stable conceptual model is:

`User → manages → Patient`

`User → Staff → Doctor`

`Patient → Appointment → Doctor`

`Patient → Visit`

`Visit → WorkflowTask`

`WorkflowTask → QueueEntry`

`Consultation → InvestigationOrder / Prescription / downstream WorkflowTask`

`Visit → Invoice → Payment`

## 6. Architecture

The project is a modular monolith.

Backend:

- TypeScript
- Node.js
- Express
- PostgreSQL
- REST APIs
- Zod for request-boundary validation

Frontend:

- React
- TypeScript
- existing Vite application

Core backend flow:

`HTTP Request → Authentication → Authorization → Controller → Service → PostgreSQL`

Controllers should be thin. Business rules belong in services.

## 7. Database rules

- PostgreSQL is the source of truth.
- Do not create a separate queue table for every department.
- `queue_entries` is the generic queue record.
- `queue_type` identifies the queue destination.
- `queue_source` identifies the queue origin.
- Do not persist a permanent queue position.
- Use transactions whenever one user action changes multiple related records.
- Never trust client-supplied ownership, payment success, or authorization claims.

## 8. Real-time communication

WebSockets are a planned layer but **must not be implemented automatically by AI coding agents**.

The project owner will implement the WebSocket layer personally for learning purposes.

Until then, REST APIs and normal refresh/polling may be used.

The database/business event must remain independent from the eventual WebSocket delivery mechanism.

## 9. Out of scope for the current MVP

Do not add these unless explicitly requested:

- multi-hospital / multi-tenant architecture;
- hospital_id on every table;
- microservices;
- Kafka / RabbitMQ / Redis solely for queue management;
- ICU / beds / wards / ambulance management;
- full inventory management;
- payroll / HR;
- insurance claims;
- SMS / WhatsApp messaging implementation;
- custom banking/payment gateway;
- WebSocket implementation;
- AI diagnosis or autonomous clinical decisions.

## 10. Implementation strategy

Build vertically and incrementally:

1. authentication + authorization;
2. users / patient ownership;
3. staff management + OPD registration;
4. doctor assignment + OPD queue;
5. online appointment + dynamic ETA;
6. doctor consultation;
7. workflow tasks + dependencies;
8. lab queue + reports;
9. pharmacy queue;
10. billing + online/cash payment flows;
11. patient journey / notifications;
12. WebSockets (manual project-owner implementation).

Each phase must leave the system buildable and testable.
