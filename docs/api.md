# MediQ - API Specification

**Smart India Hackathon (SIH 2026)**  
**Base URL (Local):** `http://localhost:3000`  
**Authentication Scheme:** Bearer JWT in `Authorization` header (`Authorization: Bearer <token>`)

> **Architectural Notice:** Real-time WebSockets (`ws://`, `socket.io`) are strictly deferred. All clinical workflow transitions, appointments, and queue positions are coordinated reliably through standard HTTP REST endpoints backed by PostgreSQL.

---

## 1. Authentication & Identity (`/auth`)

### 1.1 Register User Account
- **Endpoint:** `POST /auth/register`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "name": "Jane Connor",
    "email": "jane@example.com",
    "password": "password123"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
      "id": "7bcf9509-40ea-4091-8869-95e5d36e2f47",
      "name": "Jane Connor",
      "email": "jane@example.com",
      "role": "USER"
    }
  }
  ```

### 1.2 User Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "password123"
  }
  ```
- **Response (`200 OK`):** Returns signed JWT containing `userId`, `email`, `role`, and optional `staffRole`.

### 1.3 User Logout
- **Endpoint:** `POST /auth/logout`
- **Access:** Authenticated
- **Response (`200 OK`):** `{ "message": "Logged out successfully" }`

---

## 2. Staff Module (`/staff`)

### 2.1 Get Current Staff Profile
- **Endpoint:** `GET /staff/me`
- **Access:** Authenticated `STAFF`
- **Response (`200 OK`):**
  ```json
  {
    "staff_id": "c71bf9cf-fa7f-44e2-8924-f7a26f0ff2e9",
    "user_id": "893c5c82-8234-45aa-9cbf-9a008c2a514d",
    "employee_code": "NURSE-10294",
    "staff_role": "NURSE",
    "staff_status": "ACTIVE",
    "name": "Florence Nightingale",
    "email": "florence@hospital.org",
    "system_role": "STAFF",
    "doctor_id": null,
    "specialization": null,
    "department": null
  }
  ```

### 2.2 List Hospital Staff
- **Endpoint:** `GET /staff`
- **Access:** Authenticated `STAFF` or `ADMIN`
- **Query Params:** `role` (`DOCTOR`, `NURSE`, etc.), `status` (`ACTIVE`, `INACTIVE`)
- **Response (`200 OK`):** Array of staff records with user details.

---

## 3. Queue Management & Orchestration (`/queue`)

### 3.1 Join Patient Queue
- **Endpoint:** `POST /queue/join`
- **Access:** Authenticated `USER` or `STAFF`
- **Request Body:**
  ```json
  {
    "patientId": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "doctorId": "05fe88df-b599-4c8a-aef2-f94be5bfa0bc",
    "type": "WALK_IN",
    "priority": 1
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "31b46a16-64fe-4c60-a2ea-9e7aa8b56f8f",
    "patient_id": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "doctor_id": "05fe88df-b599-4c8a-aef2-f94be5bfa0bc",
    "type": "WALK_IN",
    "status": "WAITING",
    "priority": 1,
    "joined_at": "2026-09-13T17:30:00.000Z"
  }
  ```

### 3.2 View Filtered Queue
- **Endpoint:** `GET /queue`
- **Access:** Authenticated
- **Query Params:** `doctorId`, `departmentId`, `status` (`WAITING`, `CALLED`, `SERVING`)
- **Response (`200 OK`):**
  ```json
  {
    "queue": [
      {
        "id": "31b46a16-64fe-4c60-a2ea-9e7aa8b56f8f",
        "patient_id": "...",
        "patient_name": "John Connor",
        "doctor_name": "Dr. Sarah Connor",
        "priority": 10,
        "status": "WAITING",
        "position": 1
      }
    ]
  }
  ```

### 3.3 Patient Active Queue Status
- **Endpoint:** `GET /queue/patient/me` (or `GET /patients/me/queue`)
- **Access:** Authenticated `USER`
- **Response (`200 OK`):**
  ```json
  {
    "queueEntry": {
      "id": "31b46a16-64fe-4c60-a2ea-9e7aa8b56f8f",
      "status": "WAITING",
      "type": "WALK_IN",
      "doctor_name": "Dr. Sarah Connor"
    },
    "position": 2
  }
  ```

### 3.4 Doctor Active Queue Overview
- **Endpoint:** `GET /queue/doctor/me` (or `GET /doctors/me/queue`)
- **Access:** Authenticated `DOCTOR`
- **Response (`200 OK`):**
  ```json
  {
    "queue": [...],
    "currentServing": null,
    "waitingCount": 3
  }
  ```

### 3.5 Doctor Queue Action Endpoints
- `POST /queue/doctor/call-next`: Transitions the highest priority patient from `WAITING` to `CALLED`.
- `POST /queue/:queueEntryId/start`: Marks consultation underway (`SERVING`).
- `POST /doctors/queue/:queueEntryId/complete` (or `POST /queue/:queueEntryId/complete`): Marks consultation `COMPLETED`.
- `POST /doctors/queue/:queueEntryId/skip` (or `POST /queue/:queueEntryId/skip`): Marks entry `SKIPPED`.

---

## 4. Patient Profiles & Appointments (`/patients`)

### 4.1 Multi-Profile Management
- `GET /patients`: Lists all patient profiles owned by current authenticated user account.
- `POST /patients`: Creates a dependent patient profile managed by current user.
- `GET /patients/byId/:patientId`: Retrieves a specific patient profile (verifies `owner_user_id === req.user.userId` or hospital staff).
- `PATCH /patients/byId/:patientId`: Updates patient profile details.

### 4.2 Appointments & Medical Records
- `GET /patients/me/appointments`: Lists appointments for owned patient profiles.
- `POST /patients/appointments`: Books appointment with a doctor.
- `DELETE /patients/appointments/:id`: Cancels an appointment.
- `GET /patients/me/journey`: Timeline of visits, lab orders, consultations, and prescriptions.
- `GET /patients/me/consultations`: Clinical consultation notes and diagnoses.
- `GET /patients/me/prescriptions`: Active medications and dosages.
- `GET /patients/me/reports`: Ordered diagnostic lab reports.

---

## 5. Doctor Module (`/doctors`)

### 5.1 Doctor Authentication & Self Profile
- `POST /doctors/login`: Authenticates doctor via credentials. Returns JWT with `role: "STAFF"`, `staffRole: "DOCTOR"`.
- `GET /doctors/me`: Returns attending doctor profile with department name and specialization.
- `PATCH /doctors/me`: Updates doctor profile metadata.

### 5.2 Clinical Operations
- `GET /doctors/me/schedule`: Retrieves schedule of confirmed patient appointments.
- `GET /doctors/me/patients`: Retrieves roster of patients treated or scheduled.
- `GET /doctors/patients/:patientId/history`: Retrieves longitudinal medical history for a patient.
- `POST /doctors/patients/:patientId/consultation`: Creates consultation notes and issues prescriptions.
- `PATCH /doctors/consultations/:consultationId`: Modifies clinical notes.
- `POST /doctors/patients/:patientId/orders`: Orders laboratory and diagnostic investigations.
- `GET /doctors/patients/:patientId/reports`: Reviews investigation results.

---

## 6. Admin Module (`/admin`)

- `POST /admin/login`: Administrator login.
- `POST /admin/staff`: Creates staff record with assigned hospital role (`DOCTOR`, `NURSE`, etc.).
- `GET /admin/staff`: Lists all staff members with employment statuses.
- `PATCH /admin/staff/:staffId`: Modifies staff employee code, role, or status.
- `PATCH /admin/staff/:staffId/status`: Toggles staff status (`ACTIVE`, `INACTIVE`, `ON_LEAVE`).
- `POST /admin/doctors`: Creates doctor record linked to `Staff` and `Department`.
- `GET /admin/doctors`: Lists doctors with department allocations.
- `GET /admin/patients`: Lists all hospital patient profiles.
