# Project Overview: Hospital Flow

Hospital Flow is a clinical management and patient workflow coordination platform developed to streamline patient-physician interactions, appointment scheduling, clinical consultations, medication prescribing, and laboratory investigations.

---

## 🌐 Production Infrastructure & Endpoints

- **Live Backend API (Render):** [https://hospital-flow-l825.onrender.com](https://hospital-flow-l825.onrender.com)
- **Live Real-time WebSocket:** `wss://hospital-flow-l825.onrender.com`
- **Database:** PostgreSQL on cloud infrastructure with parameterized SQL via `pg.Pool`
- **Frontend App (`apps/web`):** React 19 + TypeScript + Vite, pre-configured to communicate with the live backend instance

---

## 🏛️ Repository Architecture

```text
hospital-flow/
├── apps/
│   ├── api/                   # Backend API (Express 5, Node ESM, TypeScript, PostgreSQL)
│   │   └── AI-Instructions.md # Strict AI guidelines, 4-tier modular pattern, security mandates
│   └── web/                   # Frontend Web App (React 19, TypeScript, Vite)
│       ├── AI-Instructions.md # Strict AI guidelines, component hierarchy, service client layer
│       └── .env               # Points to https://hospital-flow-l825.onrender.com
├── docs/                      # Architectural decisions and API specifications
│   ├── api.md                 # Complete HTTP & WebSocket endpoint contracts
│   └── decisions.md           # Architecture Decision Records (ADRs)
└── docker-compose.yml
```

---

## 🚀 Key Modules & Implementation Status

| Module | Purpose | Status | Key Endpoints |
| :--- | :--- | :--- | :--- |
| **Auth** | User identity, registration, session JWTs | Completed | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` |
| **Patients** | Profile, appointments, journey, records | Completed | `GET/PATCH /patients/me`, `GET/POST/DELETE /patients/appointments`, `GET /patients/me/journey`, `GET /patients/me/consultations`, `GET /patients/me/reports`, `GET /patients/me/prescriptions` |
| **Doctors** | Doctor login, schedule, patient chart, notes | Completed | `POST /doctors/login`, `GET/PATCH /doctors/me`, `GET /doctors/me/schedule`, `GET /doctors/me/patients`, `GET /doctors/patients/:id`, `POST /doctors/patients/:id/consultation`, `POST /doctors/patients/:id/orders` |
| **Admin** | Staff management, doctor onboarding | Completed | `POST /admin/login`, `POST /admin/doctors`, `GET /admin/doctors`, `GET /admin/patients` |
| **Queue** | Live patient queue transitions | Deferred | `501 Not Implemented` |
