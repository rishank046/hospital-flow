# MediQ AI Instructions

These are hard rules for AI coding agents working in this repository.

## Read before changing code

1. Read `PROJECT.md`.
2. Read `STATUS.md`.
3. Inspect the existing implementation before creating or modifying files.
4. Treat the database schema as a contract. Do not silently redesign it.
5. Check whether the requested behavior already exists before adding a duplicate implementation.

## Hard architectural rules

- TypeScript/Node.js/Express/PostgreSQL for the API.
- React/TypeScript for the web application.
- Modular monolith.
- Controller → Service → Database.
- Zod validates external HTTP input.
- Business rules live in services.
- PostgreSQL is the source of truth.
- One `users` table and one login system.
- `USER`, `STAFF`, `ADMIN` are account roles.
- Staff job roles live in `staff_profiles.staff_role`.
- A User can manage many Patients.
- A Patient is the healthcare recipient.
- A walk-in Patient may not have a website User.
- A Visit is the backbone of a hospital encounter.
- `workflow_tasks` represent work that must happen.
- `workflow_task_dependencies` represent prerequisites.
- `queue_entries` is the shared queue model.
- Do not create separate queues for OPD/LAB/PHARMACY/CASH unless explicitly requested.

## WebSocket rule — VERY IMPORTANT

**Do NOT implement, modify, replace, or redesign WebSocket functionality unless the project owner explicitly requests it.**

The project owner is implementing WebSockets manually for learning.

Do not add WebSocket client hooks, servers, event buses, socket providers, or replacement realtime libraries as part of unrelated tasks.

## Scope rules

Do not introduce:

- multi-tenancy;
- `hospital_id` everywhere;
- microservices;
- Redis/Kafka/RabbitMQ for patient queues;
- unrelated hospital-management modules;
- speculative abstractions;
- large dependency additions without a concrete reason.

## Security rules

- Never use `jwt.decode()` as authentication.
- Verify JWT signatures.
- Unauthenticated = HTTP 401.
- Authenticated but forbidden = HTTP 403.
- Never trust a user-supplied patient owner ID.
- Verify that the authenticated User owns a Patient before returning private patient data.
- Verify staff role on privileged endpoints.
- Admin-only actions must be enforced server-side.
- Never trust a browser-provided payment success state.

## Database rules

- Use parameterized SQL / the existing database abstraction.
- Use transactions for multi-row state changes.
- Do not persist a permanent queue position.
- Do not duplicate patient/appointment/visit data unnecessarily.
- Preserve foreign-key relationships.
- Do not change enums or table relationships as a side effect of implementing an unrelated feature.

## Code quality

- Do not use `any` to bypass TypeScript errors.
- Prefer existing project utilities and conventions.
- Keep controllers thin.
- Keep services deterministic and testable.
- Avoid giant files when the existing module structure provides a natural boundary.
- Do not rewrite working modules just to apply a personal style preference.

## Testing

For every business-critical backend feature:

1. add or update tests;
2. run the relevant tests;
3. run TypeScript/build checks;
4. report failures honestly.

Never claim tests pass unless they were actually run.

## Change reporting

At the end of a task report:

- files changed;
- database changes, if any;
- API changes, if any;
- tests run and result;
- build/type-check result;
- any unresolved risk or follow-up.
