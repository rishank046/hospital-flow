# MediQ Web AI Instructions

Read the root `PROJECT.md` and `AI-INSTRUCTIONS.md` first. These rules are web-specific.

## Authentication UX

There is one login page for everyone.

After login, route the user according to account/staff role:

- USER → patient/user portal;
- STAFF + DOCTOR → doctor dashboard;
- STAFF + OPD_MANAGER → OPD management portal;
- STAFF + LAB_TECH → lab portal;
- STAFF + PHARMACIST → pharmacy portal;
- STAFF + BILLING_CLERK → billing portal;
- ADMIN → admin staff-management portal.

Do not create separate login systems per staff role.

Frontend role routing is UX only. The backend is the final authorization authority.

## Patient model

A logged-in User can manage multiple Patient profiles.

The appointment is always for a Patient.

The UI should make it obvious which Patient the User is currently acting for.

## Workflow UX

The patient should always be able to understand:

- current stage;
- active queue, if any;
- estimated waiting window;
- what is blocking the next step;
- whether a lab report is available;
- whether medicine is ready;
- billing/payment state.

Do not present estimated times as guaranteed appointment times.

## Queue UX

Doctor, lab, pharmacy, and cash queues use the shared backend queue model but can have department-specific UI.

Never derive an authoritative queue position solely from stale frontend state.

After an action that changes queue state, refresh from the API until WebSockets are manually added by the project owner.

## Clinical workflow UI

Doctor actions must trigger actual backend workflow behavior. Do not simulate downstream queues only in React state.

Example:

Doctor marks blood test required → API creates/activates the lab workflow.

Doctor creates a pharmacy requirement that depends on a lab → UI reflects the blocked/ready state returned by the API.

## WebSocket rule

Do not add WebSocket hooks, providers, clients, or realtime libraries unless the project owner explicitly requests them.

## UX constraints

- Prefer the existing component system.
- Do not replace the whole design system for a feature.
- Keep role-specific screens focused on the staff member's job.
- Do not create fake data when an API endpoint should be used.
- Do not hide backend errors behind generic success messages.
