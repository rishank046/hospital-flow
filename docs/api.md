# Hospital Flow API Specification

This document details the complete HTTP and WebSocket interface for the **Hospital Flow** backend.

---

## 🌐 Environments & Base URLs

| Environment | HTTP Base URL | WebSocket Base URL |
| :--- | :--- | :--- |
| **Live Production (Render)** | `https://hospital-flow-l825.onrender.com` | `wss://hospital-flow-l825.onrender.com` |
| **Local Development** | `http://localhost:3000` | `ws://localhost:3000` |

All JSON requests must include the header:
```http
Content-Type: application/json
```

All protected endpoints require the signed JWT in the `Authorization` header:
```http
Authorization: Bearer <token>
```

---

## 1. Authentication Module (`/auth`)

### 1.1 Patient Registration
- **Endpoint:** `POST /auth/register`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "password123"
  }
  ```
- **Validation:**
  - `name`: String, minimum 1 character.
  - `email`: Valid email format.
  - `password`: String, minimum 6 characters.
- **Success Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```
  *Note:* Registration automatically creates the user record and signs the user in, returning a 4-hour JWT with `role: "PATIENT"`.

### 1.2 Patient Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "password123"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```

### 1.3 Logout
- **Endpoint:** `POST /auth/logout`
- **Access:** Authenticated (`PATIENT`, `DOCTOR`, or `ADMIN`)
- **Headers:** `Authorization: Bearer <token>`
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

### 1.4 Unimplemented Authentication Routes
| Method | Endpoint | Status |
| :--- | :--- | :--- |
| `POST` | `/auth/refresh` | `501 Not Implemented` |
| `POST` | `/auth/forgot-password` | `501 Not Implemented` |
| `POST` | `/auth/reset-password` | `501 Not Implemented` |

---

## 2. Patient Module (`/patients`)

All patient endpoints require `Authorization: Bearer <token>` with `role: "PATIENT"` (or legacy `role: "USER"`).

### 2.1 Get Patient Profile
- **Endpoint:** `GET /patients/me`
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "eaf3fb17-176f-4776-afff-7d59a1ed7e16",
    "owner_user_id": "a6c78572-3e5c-4941-a327-3874e125369d",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "age": 30,
    "gender": "Female",
    "patient_type": "Online",
    "doctor_id": null,
    "created_at": "2026-09-13T09:40:07.416Z"
  }
  ```

### 2.2 Update Patient Profile
- **Endpoint:** `PATCH /patients/me`
- **Request Body (all fields optional):**
  ```json
  {
    "name": "Jane Doe",
    "age": 31,
    "gender": "Female",
    "patientType": "Online",
    "doctorId": "d3b07384-d113-40e9-a477-94a55dc0ebf0"
  }
  ```
- **Validation:**
  - `age`: Must be an integer $> 0$.
  - `gender`: `"Male"` | `"Female"` | `"Other"`.
  - `patientType`: `"Online"` | `"Walkin"`.
  - `doctorId`: Valid UUID or omitted.
- **Success Response (`200 OK`):** Updated patient record object.

### 2.3 Get Appointments
- **Endpoint:** `GET /patients/me/appointments`
- **Success Response (`200 OK`):**
  ```json
  {
    "appointments": [
      {
        "id": "c1f72a4d-8012-4299-8cfb-6f68e00185f3",
        "start_time": "2026-09-14T09:00:00.000Z",
        "end_time": "2026-09-14T09:30:00.000Z",
        "created_at": "2026-09-13T10:00:00.000Z",
        "doctor_id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
        "doctor_name": "Dr. Sarah Connor",
        "doctor_specialization": "Cardiology",
        "doctor_department": "Cardiology Department"
      }
    ]
  }
  ```

### 2.4 Book Appointment
- **Endpoint:** `POST /patients/appointments`
- **Request Body:**
  ```json
  {
    "doctorId": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
    "startTime": "2026-09-14T09:00:00.000Z",
    "endTime": "2026-09-14T09:30:00.000Z"
  }
  ```
- **Errors:**
  - `400 Bad Request`: `endTime <= startTime` or invalid datetime format.
  - `404 Not Found`: Doctor does not exist.
  - `409 Conflict`: Doctor already has an overlapping appointment in that time slot.
- **Success Response (`201 Created`):**
  ```json
  {
    "id": "c1f72a4d-8012-4299-8cfb-6f68e00185f3",
    "patient_id": "eaf3fb17-176f-4776-afff-7d59a1ed7e16",
    "doctor_id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
    "start_time": "2026-09-14T09:00:00.000Z",
    "end_time": "2026-09-14T09:30:00.000Z",
    "created_at": "2026-09-13T10:00:00.000Z",
    "doctor": {
      "id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
      "name": "Dr. Sarah Connor",
      "specialization": "Cardiology",
      "department": "Cardiology Department"
    }
  }
  ```

### 2.5 Cancel Appointment
- **Endpoint:** `DELETE /patients/appointments/:appointmentId`
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Appointment cancelled successfully"
  }
  ```

### 2.6 Care Journey Timeline
- **Endpoint:** `GET /patients/me/journey`
- **Description:** Aggregates all user milestones chronologically (registration, appointments, consultations, lab investigations, and prescriptions).
- **Success Response (`200 OK`):**
  ```json
  {
    "journey": [
      {
        "type": "APPOINTMENT",
        "title": "Appointment with Dr. Sarah Connor",
        "timestamp": "2026-09-14T09:00:00.000Z",
        "status": "SCHEDULED",
        "details": {
          "appointmentId": "c1f72a4d-8012-4299-8cfb-6f68e00185f3",
          "doctorName": "Dr. Sarah Connor",
          "specialization": "Cardiology",
          "department": "Cardiology Department",
          "startTime": "2026-09-14T09:00:00.000Z",
          "endTime": "2026-09-14T09:30:00.000Z"
        }
      },
      {
        "type": "REGISTRATION",
        "title": "Patient Registered",
        "timestamp": "2026-09-13T09:38:59.852Z",
        "details": {
          "name": "Jane Doe",
          "email": "jane@example.com"
        }
      }
    ]
  }
  ```

### 2.7 Patient Consultations
- **Endpoint:** `GET /patients/me/consultations`
- **Success Response (`200 OK`):**
  ```json
  {
    "consultations": [
      {
        "id": "3b290744-934c-4ec9-86c2-19e34c97fb48",
        "diagnosis": "Mild hypertension",
        "notes": "Patient reported occasional dizziness",
        "treatment_plan": "Lifestyle adjustments and BP monitoring",
        "created_at": "2026-09-13T10:30:00.000Z",
        "updated_at": "2026-09-13T10:30:00.000Z",
        "doctor_id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
        "doctor_name": "Dr. Sarah Connor",
        "doctor_specialization": "Cardiology",
        "doctor_department": "Cardiology Department",
        "prescriptions": []
      }
    ]
  }
  ```

### 2.8 Patient Prescriptions
- **Endpoint:** `GET /patients/me/prescriptions`
- **Success Response (`200 OK`):**
  ```json
  {
    "prescriptions": [
      {
        "id": "f51ae039-38b9-43c3-9877-3e1cb07c9172",
        "consultation_id": "3b290744-934c-4ec9-86c2-19e34c97fb48",
        "medication": "Amlodipine",
        "dosage": "5mg",
        "frequency": "Once daily",
        "duration": "30 days",
        "instructions": "Take after breakfast",
        "created_at": "2026-09-13T10:30:00.000Z",
        "doctor_id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
        "doctor_name": "Dr. Sarah Connor",
        "doctor_specialization": "Cardiology"
      }
    ]
  }
  ```

### 2.9 Patient Lab Reports
- **Endpoint:** `GET /patients/me/reports`
- **Success Response (`200 OK`):**
  ```json
  {
    "reports": [
      {
        "id": "9924c8b2-38b9-43c3-9877-1e1cb07c9172",
        "test_name": "Lipid Panel",
        "instructions": "12-hour fasting required",
        "status": "PENDING",
        "result": null,
        "created_at": "2026-09-13T10:35:00.000Z",
        "updated_at": "2026-09-13T10:35:00.000Z",
        "doctor_id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
        "doctor_name": "Dr. Sarah Connor",
        "doctor_department": "Cardiology Department"
      }
    ]
  }
  ```

### 2.10 Patient Queue (Excluded)
| Method | Endpoint | Status |
| :--- | :--- | :--- |
| `GET` | `/patients/me/queue` | `501 Not Implemented` |

---

## 3. Doctor Module (`/doctors`)

All doctor endpoints require `Authorization: Bearer <token>` with `role: "DOCTOR"` (except `POST /doctors/login`).

### 3.1 Doctor Login
- **Endpoint:** `POST /doctors/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "doctor@hospital.org",
    "password": "password123"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "doctor": {
      "id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
      "name": "Dr. Sarah Connor",
      "email": "doctor@hospital.org",
      "specialization": "Cardiology",
      "department": "Cardiology Department",
      "createdAt": "2026-09-13T08:00:00.000Z"
    }
  }
  ```

### 3.2 Doctor Profile
- **Get Profile:** `GET /doctors/me` $\rightarrow$ returns doctor details.
- **Update Profile:** `PATCH /doctors/me`
  - **Request Body:**
    ```json
    {
      "name": "Dr. Sarah Connor",
      "specialization": "Cardiology",
      "department": "Cardiology Department"
    }
    ```
  - **Allowed Specializations:**
    `"Cardiology"`, `"Dermatology"`, `"Neurology"`, `"Pediatrics"`, `"Psychiatry"`, `"Radiology"`, `"Surgery"`, `"Urology"`, `"Oncology"`, `"Orthopedics"`.

### 3.3 Doctor Daily Schedule
- **Endpoint:** `GET /doctors/me/schedule`
- **Success Response (`200 OK`):**
  ```json
  {
    "schedule": [
      {
        "id": "c1f72a4d-8012-4299-8cfb-6f68e00185f3",
        "start_time": "2026-09-14T09:00:00.000Z",
        "end_time": "2026-09-14T09:30:00.000Z",
        "created_at": "2026-09-13T10:00:00.000Z",
        "patient_id": "eaf3fb17-176f-4776-afff-7d59a1ed7e16",
        "patient_name": "Jane Doe",
        "patient_age": 30,
        "patient_gender": "Female",
        "patient_type": "Online"
      }
    ]
  }
  ```

### 3.4 Doctor Patient Roster
- **Endpoint:** `GET /doctors/me/patients`
- **Success Response (`200 OK`):**
  ```json
  {
    "patients": [
      {
        "id": "eaf3fb17-176f-4776-afff-7d59a1ed7e16",
        "name": "Jane Doe",
        "age": 30,
        "gender": "Female",
        "patient_type": "Online",
        "created_at": "2026-09-13T09:40:07.416Z",
        "owner_email": "jane@example.com"
      }
    ]
  }
  ```

### 3.5 Patient Medical Chart
- **Endpoint:** `GET /doctors/patients/:patientId`
- **Success Response (`200 OK`):**
  ```json
  {
    "patient": {
      "id": "eaf3fb17-176f-4776-afff-7d59a1ed7e16",
      "name": "Jane Doe",
      "age": 30,
      "gender": "Female",
      "patient_type": "Online",
      "created_at": "2026-09-13T09:40:07.416Z",
      "doctor_id": "d3b07384-d113-40e9-a477-94a55dc0ebf0",
      "owner_email": "jane@example.com"
    },
    "appointments": [],
    "consultations": [],
    "prescriptions": [],
    "reports": []
  }
  ```

### 3.6 Create Consultation
- **Endpoint:** `POST /doctors/patients/:patientId/consultation`
- **Request Body:**
  ```json
  {
    "appointmentId": "c1f72a4d-8012-4299-8cfb-6f68e00185f3",
    "diagnosis": "Mild hypertension",
    "notes": "Patient reported dizziness",
    "treatmentPlan": "Lifestyle changes and BP monitoring",
    "prescriptions": [
      {
        "medication": "Amlodipine",
        "dosage": "5mg",
        "frequency": "Once daily",
        "duration": "30 days",
        "instructions": "Take after breakfast"
      }
    ]
  }
  ```
- **Success Response (`201 Created`):** Returns consultation entity with inserted `prescriptions` array.

### 3.7 Update Consultation
- **Endpoint:** `PATCH /doctors/consultations/:consultationId`
- **Request Body (all fields optional):**
  ```json
  {
    "diagnosis": "Stage 1 hypertension",
    "notes": "Updated note after lab confirmation",
    "treatmentPlan": "Continue amlodipine 5mg"
  }
  ```
- **Success Response (`200 OK`):** Updated consultation record.

### 3.8 Order Lab Test
- **Endpoint:** `POST /doctors/patients/:patientId/orders`
- **Request Body:**
  ```json
  {
    "testName": "Complete Blood Count (CBC)",
    "instructions": "Fasting blood draw"
  }
  ```
- **Success Response (`201 Created`):** Returns created `InvestigationOrder` with `status: "PENDING"`.

### 3.9 Doctor Queue (Excluded)
| Method | Endpoint | Status |
| :--- | :--- | :--- |
| `GET` | `/doctors/me/queue` | `501 Not Implemented` |
| `POST` | `/doctors/queue/:queueEntryId/complete` | `501 Not Implemented` |
| `POST` | `/doctors/queue/:queueEntryId/skip` | `501 Not Implemented` |

---

## 4. Admin Module (`/admin`)

All admin routes except `/admin/login` require `Authorization: Bearer <token>` with `role: "ADMIN"`.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/admin/login` | Public | Authenticates admin user |
| `POST` | `/admin/doctors` | `ADMIN` | Registers a new doctor with specialization & department |
| `GET` | `/admin/doctors` | `ADMIN` | Lists all registered doctors |
| `GET` | `/admin/patients`| `ADMIN` | Lists all hospital patients |

---

## 5. Real-Time WebSocket (`ws://` / `wss://`)

- **Connection URL:**
  - Local: `ws://localhost:3000`
  - Production: `wss://hospital-flow-l825.onrender.com`
- **Capabilities:**
  - Real-time notifications for appointment updates, consultation recordings, and queue notifications.
