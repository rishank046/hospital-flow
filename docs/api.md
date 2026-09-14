# MediQ - API Specification

**Smart India Hackathon (SIH 2026)**  
**Base URL (Local):** `http://localhost:3000`  
**Authentication Scheme:** Bearer JWT in `Authorization` header (`Authorization: Bearer <token>`)

> **Architectural Notice:** Real-time WebSockets (`ws://`, `socket.io`) are strictly deferred. All clinical workflow transitions, visits, appointments, diagnostic orders, and queue positions are coordinated reliably through standard HTTP REST endpoints backed by PostgreSQL.

---

## 1. Authentication & Identity (`/auth`)

### 1.1 Register User / Patient Account
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
      "role": "PATIENT"
    }
  }
  ```

### 1.2 Unified Login
Single login entry point for all roles (`PATIENT`, `STAFF`, and `ADMIN`), backed by the unified `users` table.
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "doctor@hospital.org",
    "password": "securePassword123!"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
      "id": "893c5c82-8234-45aa-9cbf-9a008c2a514d",
      "name": "Dr. Sarah Connor",
      "email": "doctor@hospital.org",
      "role": "STAFF",
      "staffRole": "DOCTOR"
    }
  }
  ```
  *(Note: `staffRole` is populated for `STAFF` users via `staff_profiles` and omitted/null for `PATIENT` and `ADMIN` users).*

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
- **Query Params:** `role` (`DOCTOR`, `NURSE`, `PHARMACIST`, `LAB_TECH`, `RECEPTIONIST`, `BILLING_CLERK`), `status` (`ACTIVE`, `INACTIVE`, `ON_LEAVE`)
- **Response (`200 OK`):** Array of staff records joined with user information.

### 2.3 Legacy Staff Login
- **Endpoint:** `POST /staff/login`
- **Access:** Public (delegates to unified auth service)
- **Response (`200 OK`):** Same as `/auth/login`.

---

## 3. Patient Visits Module (`/visits`)

The `visits` table serves as the central backbone tracking the entire clinical lifecycle of a patient hospital encounter.

### 3.1 Create Visit
- **Endpoint:** `POST /visits`
- **Access:** Authenticated `STAFF` (receptionist/nurse) or patient self check-in
- **Request Body:**
  ```json
  {
    "patientId": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "visitType": "OPD",
    "assignedDoctorId": "05fe88df-b599-4c8a-aef2-f94be5bfa0bc",
    "departmentId": "a1195610-c1e1-450f-a39c-2ec03df6a925",
    "appointmentId": null
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "patient_id": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "visit_type": "OPD",
    "status": "REGISTERED",
    "assigned_doctor_id": "05fe88df-b599-4c8a-aef2-f94be5bfa0bc",
    "department_id": "a1195610-c1e1-450f-a39c-2ec03df6a925",
    "appointment_id": null,
    "registered_by": "893c5c82-8234-45aa-9cbf-9a008c2a514d",
    "created_at": "2026-09-14T10:00:00.000Z"
  }
  ```

### 3.2 Get Complete Visit Detail
- **Endpoint:** `GET /visits/:id`
- **Access:** Authenticated `STAFF` or owning `PATIENT`
- **Response (`200 OK`):**
  Returns full visit record with joined clinical relations:
  ```json
  {
    "id": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "patient_id": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "status": "IN_CONSULTATION",
    "visit_type": "OPD",
    "patient_name": "John Connor",
    "doctor_name": "Dr. Sarah Connor",
    "department_name": "General Medicine",
    "vitals": [...],
    "queueEntries": [...],
    "consultations": [...],
    "prescriptions": [...],
    "investigationOrders": [...],
    "invoices": [...]
  }
  ```

### 3.3 Get Patient Active Visit
- **Endpoint:** `GET /patients/me/current-visit`
- **Access:** Authenticated `PATIENT`
- **Response (`200 OK`):** Active visit object (`status NOT IN ('COMPLETED', 'CANCELLED')`) or `null` if no active visit.

### 3.4 Transition Visit Status
- **Endpoint:** `PATCH /visits/:id/status`
- **Access:** Authenticated `STAFF`
- **Allowed Forward Flow:**
  `REGISTERED` -> `VITALS` -> `WAITING_OPD` -> `IN_CONSULTATION` -> `LAB_PENDING` -> `PHARMACY_PENDING` -> `BILLING` -> `COMPLETED`  
  *(or `CANCELLED` from any non-final state)*
- **Request Body:**
  ```json
  {
    "status": "WAITING_OPD"
  }
  ```
- **Response (`200 OK`):** Updated visit object.

---

## 4. Queue Management & Orchestration (`/queue`)

Queue entries are attached directly to a `visit_id`. Queue actions automatically advance the associated visit status.

### 4.1 Join Queue
- **Endpoint:** `POST /queue/join`
- **Access:** Authenticated `PATIENT` or `STAFF`
- **Request Body:**
  ```json
  {
    "visitId": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "doctorId": "05fe88df-b599-4c8a-aef2-f94be5bfa0bc",
    "priority": 1,
    "type": "WALK_IN"
  }
  ```
  *(Note: If `visitId` is omitted for walk-in patients, a visit is automatically created in `REGISTERED` status and then joined).*
- **Side Effect:** Transitions linked visit status to `WAITING_OPD`.
- **Response (`201 Created`):**
  ```json
  {
    "id": "31b46a16-64fe-4c60-a2ea-9e7aa8b56f8f",
    "visit_id": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "patient_id": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "doctor_id": "05fe88df-b599-4c8a-aef2-f94be5bfa0bc",
    "status": "WAITING",
    "priority": 1,
    "type": "WALK_IN",
    "joined_at": "2026-09-14T10:05:00.000Z"
  }
  ```

### 4.2 List Queue Entries
- **Endpoint:** `GET /queue`
- **Access:** Authenticated
- **Query Params:** `doctorId`, `departmentId`, `status`
- **Response (`200 OK`):** Sorted by `priority DESC, joined_at ASC` with `waitingCount`.

### 4.3 Patient Active Queue Status
- **Endpoint:** `GET /patients/me/queue` (or `GET /queue/patient/me`)
- **Access:** Authenticated `PATIENT`
- **Response (`200 OK`):** Active queue entry and current waiting position.

### 4.4 Doctor Queue Overview
- **Endpoint:** `GET /doctors/me/queue` (or `GET /queue/doctor/me`)
- **Access:** Authenticated `DOCTOR`
- **Response (`200 OK`):** Doctor's waiting patient queue and count.

### 4.5 Doctor Call Next Patient
- **Endpoint:** `POST /queue/doctor/call-next`
- **Access:** Authenticated `DOCTOR`
- **Response (`200 OK`):** Selects next patient (`WAITING`, highest priority, earliest join), updates status to `CALLED`, and sets `called_at`.

### 4.6 Start Consultation
- **Endpoint:** `POST /queue/:queueEntryId/start`
- **Access:** Authenticated `DOCTOR`
- **Side Effect:** Updates queue entry status to `IN_PROGRESS` (sets `started_at`) and automatically transitions linked visit status to `IN_CONSULTATION`.
- **Response (`200 OK`):** Updated queue entry.

### 4.7 Complete Queue Consultation
- **Endpoint:** `POST /queue/:queueEntryId/complete` (or `POST /doctors/queue/:queueEntryId/complete`)
- **Access:** Authenticated `DOCTOR`
- **Response (`200 OK`):** Updates queue entry to `COMPLETED` and sets `completed_at`.

### 4.8 Skip Queue Entry
- **Endpoint:** `POST /queue/:queueEntryId/skip` (or `POST /doctors/queue/:queueEntryId/skip`)
- **Access:** Authenticated `DOCTOR`
- **Response (`200 OK`):** Sets queue entry status to `SKIPPED`.

---

## 5. Vitals Module (`/visits/:visitId/vitals` & `/vitals`)

### 5.1 Record Patient Vitals
- **Endpoint:** `POST /visits/:visitId/vitals` (or `POST /vitals`)
- **Access:** Authenticated `STAFF` (Nurse / Receptionist)
- **Side Effect:** Automatically transitions visit status to `VITALS`.
- **Request Body:**
  ```json
  {
    "temperature": 98.6,
    "heartRate": 72,
    "bloodPressure": "120/80",
    "respiratoryRate": 16,
    "oxygenSaturation": 99,
    "weight": 70.5,
    "height": 175.0,
    "notes": "Patient reports mild cough"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "e30cbb5a-0d12-4217-a006-2cb3aef7aa01",
    "visit_id": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "recorded_by": "893c5c82-8234-45aa-9cbf-9a008c2a514d",
    "temperature": "98.6",
    "heart_rate": 72,
    "blood_pressure": "120/80",
    "respiratory_rate": 16,
    "oxygen_saturation": 99,
    "weight": "70.5",
    "height": "175.0",
    "notes": "Patient reports mild cough",
    "created_at": "2026-09-14T10:10:00.000Z"
  }
  ```

### 5.2 Get Visit Vitals
- **Endpoint:** `GET /visits/:visitId/vitals`
- **Access:** Authenticated `STAFF` or owning `PATIENT`
- **Response (`200 OK`):** `{ "vitals": [...] }`

---

## 6. Consultations Module (`/consultations` & `/doctors`)

### 6.1 Create Consultation
- **Endpoint:** `POST /doctors/patients/:patientId/consultation` (or `POST /consultations`)
- **Access:** Authenticated `DOCTOR`
- **Request Body:**
  ```json
  {
    "visitId": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "diagnosis": "Acute Bronchitis",
    "notes": "Bilateral rhonchi, clear sputum",
    "treatmentPlan": "Rest, hydration, antibiotics",
    "prescriptions": [
      {
        "medication": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "TDS",
        "duration": "7 days",
        "instructions": "Take after food"
      }
    ]
  }
  ```
  *(Note: If `visitId` is omitted, the patient's active visit is automatically resolved).*
- **Side Effect:** Automatically creates linked `prescriptions` rows with `status = 'PENDING'` and `visit_id`.
- **Response (`201 Created`):**
  ```json
  {
    "id": "76df1733-4fec-41f2-ba78-f7b6bcf314d3",
    "patient_id": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "doctor_id": "05fe88df-b599-4c8a-aef2-f94be5bfa0bc",
    "visit_id": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "diagnosis": "Acute Bronchitis",
    "notes": "Bilateral rhonchi, clear sputum",
    "treatment_plan": "Rest, hydration, antibiotics",
    "prescriptions": [
      {
        "id": "2d1bfa12-32a1-435f-bf92-66b96e95bda4",
        "medication": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "TDS",
        "duration": "7 days",
        "instructions": "Take after food",
        "status": "PENDING",
        "visit_id": "c83b8b15-9c97-40c2-9e90-272e50523091"
      }
    ]
  }
  ```

### 6.2 Update Consultation
- **Endpoint:** `PATCH /doctors/consultations/:id` (or `PATCH /consultations/:id`)
- **Access:** Authenticated `DOCTOR`
- **Request Body:** `{ "notes": "...", "treatmentPlan": "..." }`
- **Response (`200 OK`):** Updated consultation row.

---

## 7. Prescriptions & Pharmacy Module (`/prescriptions`)

### 7.1 List Prescriptions
- **Endpoint:** `GET /prescriptions`
- **Access:** Authenticated `STAFF` (Doctor, Pharmacist, Nurse)
- **Query Params:** `patientId`, `visitId`, `status` (`PENDING`, `DISPENSED`, `PARTIALLY_DISPENSED`, `CANCELLED`)
- **Response (`200 OK`):** Array of prescriptions joined with patient and doctor details.

### 7.2 Get Prescription Detail
- **Endpoint:** `GET /prescriptions/:id`
- **Access:** Authenticated `STAFF` or owning `PATIENT`
- **Response (`200 OK`):** Prescription detail with joined `dispenses` array.

### 7.3 Dispense Prescription (Pharmacist)
- **Endpoint:** `PATCH /prescriptions/:id/dispense`
- **Access:** Authenticated `STAFF` (Pharmacist)
- **Request Body:**
  ```json
  {
    "quantity": 21,
    "notes": "Full course dispensed in blister pack"
  }
  ```
- **Side Effect:** Inserts a record into `pharmacy_dispenses` (with `dispensed_by` = authenticated user) and updates `Prescription.status` to `DISPENSED`.
- **Response (`200 OK`):**
  ```json
  {
    "prescription": {
      "id": "2d1bfa12-32a1-435f-bf92-66b96e95bda4",
      "status": "DISPENSED"
    },
    "dispense": {
      "id": "90e66c0d-dff8-4ca7-8178-5a6396f4e69d",
      "prescription_id": "2d1bfa12-32a1-435f-bf92-66b96e95bda4",
      "dispensed_by": "893c5c82-8234-45aa-9cbf-9a008c2a514d",
      "dispensed_quantity": 21,
      "notes": "Full course dispensed in blister pack",
      "created_at": "2026-09-14T10:25:00.000Z"
    }
  }
  ```

---

## 8. Laboratory & Diagnostic Orders (`/lab-orders`)

### 8.1 Create Investigation Order
- **Endpoint:** `POST /lab-orders` (or `POST /doctors/patients/:patientId/orders`)
- **Access:** Authenticated `DOCTOR` or `STAFF`
- **Request Body:**
  ```json
  {
    "patientId": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "visitId": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "testName": "Complete Blood Count (CBC)",
    "instructions": "Fasting sample"
  }
  ```
  *(Note: If `visitId` is omitted, the patient's active visit is automatically resolved).*
- **Response (`201 Created`):**
  ```json
  {
    "id": "8f8705bc-d843-41bb-98a9-46bf8b093374",
    "patient_id": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "visit_id": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "test_name": "Complete Blood Count (CBC)",
    "instructions": "Fasting sample",
    "status": "PENDING",
    "result": null,
    "performed_by": null,
    "created_at": "2026-09-14T10:15:00.000Z"
  }
  ```

### 8.2 List Lab Orders
- **Endpoint:** `GET /lab-orders`
- **Access:** Authenticated `STAFF` (Doctor, Lab Technician, Nurse)
- **Query Params:** `patientId`, `visitId`, `doctorId`, `status` (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
- **Response (`200 OK`):** Array of lab orders joined with patient and staff names.

### 8.3 Get Lab Order Detail
- **Endpoint:** `GET /lab-orders/:id`
- **Access:** Authenticated `STAFF` or owning `PATIENT`
- **Response (`200 OK`):** Lab order details with result and technician info.

### 8.4 Update Lab Order / Fulfill Test (Lab Technician)
- **Endpoint:** `PATCH /lab-orders/:id`
- **Access:** Authenticated `STAFF` (Lab Technician)
- **Request Body:**
  ```json
  {
    "status": "COMPLETED",
    "result": "WBC: 6,500/mcL, Hb: 14.2 g/dL, Platelets: 250,000/mcL. Normal range.",
    "instructions": "Sample analyzed on Automated Sysmex"
  }
  ```
- **Side Effect:** Updates status, stores result, and sets `performed_by = req.user.userId`.
- **Response (`200 OK`):** Updated lab order record.

### 8.5 Patient Lab Reports
- `GET /doctors/patients/:patientId/reports`: Attending doctor reviews investigation results.
- `GET /patients/me/reports`: Patient accesses test reports.

---

## 9. Billing & Invoices Module (`/invoices` & `/visits/:visitId/invoice`)

### 9.1 Generate Visit Invoice
- **Endpoint:** `POST /visits/:visitId/invoice` (or `POST /billing/visits/:visitId/invoice`)
- **Access:** Authenticated `STAFF` (Billing Clerk / Nurse)
- **Request Body:**
  ```json
  {
    "dueDate": "2026-09-20T00:00:00.000Z"
  }
  ```
- **Automatic Item Calculation:**
  Aggregates the visit encounter into `invoice_items`:
  - `CONSULTATION`: ₹500
  - `INVESTIGATION`: ₹350 per ordered test
  - `MEDICATION`: ₹100 per dispensed prescription
- **Side Effect:** Transitions linked visit status to `BILLING`.
- **Response (`201 Created`):**
  ```json
  {
    "id": "c0aa46bc-ca1e-450f-90db-3b093374b889",
    "visit_id": "c83b8b15-9c97-40c2-9e90-272e50523091",
    "patient_id": "3b29c927-4638-4e89-8d77-628dcf3519b7",
    "amount": "950.00",
    "status": "PENDING",
    "invoice_items": [
      {
        "id": "...",
        "item_type": "CONSULTATION",
        "description": "Doctor Consultation - Dr. Sarah Connor",
        "quantity": 1,
        "unit_price": "500.00",
        "total_price": "500.00"
      },
      {
        "id": "...",
        "item_type": "INVESTIGATION",
        "description": "Chest X-Ray",
        "quantity": 1,
        "unit_price": "350.00",
        "total_price": "350.00"
      },
      {
        "id": "...",
        "item_type": "MEDICATION",
        "description": "Amoxicillin",
        "quantity": 1,
        "unit_price": "100.00",
        "total_price": "100.00"
      }
    ]
  }
  ```

### 9.2 Get Invoice Detail
- **Endpoint:** `GET /invoices/:id`
- **Access:** Authenticated `STAFF` or owning `PATIENT`
- **Response (`200 OK`):** Invoice details with joined `invoice_items` and `payments`.

### 9.3 Pay Invoice
- **Endpoint:** `PATCH /invoices/:id/pay`
- **Access:** Authenticated `STAFF` (Billing Clerk) or `PATIENT`
- **Request Body:**
  ```json
  {
    "paymentMethod": "UPI",
    "transactionRef": "UPI-TXN-9840281"
  }
  ```
- **Side Effect:** Records payment in `payments`, marks invoice `status = 'PAID'`, and automatically transitions the linked visit status to `COMPLETED`.
- **Response (`200 OK`):**
  ```json
  {
    "invoice": {
      "id": "c0aa46bc-ca1e-450f-90db-3b093374b889",
      "status": "PAID",
      "paid_at": "2026-09-14T10:30:00.000Z"
    },
    "payment": {
      "id": "e441be8a-5431-4ec1-91a1-8ab40281cc41",
      "amount": "950.00",
      "payment_method": "UPI",
      "status": "COMPLETED"
    }
  }
  ```

---

## 10. Patient Profiles & Appointments (`/patients`)

### 10.1 Multi-Profile Management
- `GET /patients`: Lists all patient profiles owned by current authenticated user account.
- `POST /patients`: Creates a dependent patient profile managed by current user.
- `GET /patients/byId/:patientId`: Retrieves a specific patient profile (verifies `owner_user_id === req.user.userId` or hospital staff).
- `PATCH /patients/byId/:patientId`: Updates patient profile details.

### 10.2 Appointments & Medical Records
- `GET /patients/me/appointments`: Lists appointments for owned patient profiles.
- `POST /patients/appointments`: Books appointment with a doctor.
- `DELETE /patients/appointments/:id`: Cancels an appointment.
- `GET /patients/me/journey`: Timeline of visits, lab orders, consultations, and prescriptions.
- `GET /patients/me/consultations`: Clinical consultation notes and diagnoses.
- `GET /patients/me/prescriptions`: Active medications and dosages.
- `GET /patients/me/reports`: Ordered diagnostic lab reports.

---

## 11. Doctor Operations (`/doctors`)

### 11.1 Self Profile & Schedules
- `GET /doctors/me`: Returns attending doctor profile with department name and specialization.
- `PATCH /doctors/me`: Updates doctor profile metadata.
- `GET /doctors/me/schedule`: Retrieves schedule of confirmed patient appointments.
- `GET /doctors/me/patients`: Retrieves roster of patients treated or scheduled.

### 11.2 Clinical Operations
- `GET /doctors/patients/:patientId/history`: Longitudinal medical history for a patient.
- `POST /doctors/patients/:patientId/consultation`: Creates consultation and linked prescriptions attached to active visit.
- `PATCH /doctors/consultations/:consultationId`: Modifies clinical notes.
- `POST /doctors/patients/:patientId/orders`: Orders laboratory and diagnostic investigations attached to active visit.
- `GET /doctors/patients/:patientId/reports`: Reviews investigation results.

---

## 12. Admin Module (`/admin`)

Staff accounts are managed exclusively by Administrators (staff no longer self-register).

### 12.1 Create Staff Account
- **Endpoint:** `POST /admin/staff`
- **Access:** Authenticated `ADMIN`
- **Atomic Transaction:**
  1. Creates row in `users` (`role = 'STAFF'`) with a securely hashed temporary password.
  2. Creates row in `staff_profiles` (`employee_code`, `staff_role`, `department_id`, `status = 'ACTIVE'`).
  3. If `staff_role = 'DOCTOR'`, creates linked row in `doctors` (`specialization`, `license_number`).
- **Request Body:**
  ```json
  {
    "name": "Dr. Gregory House",
    "email": "house@hospital.org",
    "staffRole": "DOCTOR",
    "employeeCode": "DOC-9921",
    "departmentId": "a1195610-c1e1-450f-a39c-2ec03df6a925",
    "specialization": "Diagnostic Medicine",
    "licenseNumber": "MED-NY-84920"
  }
  ```
- **Response (`201 Created`):**
  Returns created staff profile and the clearly labeled **temporaryPassword** for immediate employee onboarding:
  ```json
  {
    "message": "Staff member created successfully",
    "staff": {
      "id": "f5b6ca81-4fe1-4c12-9c1a-8e2b34a5d891",
      "user_id": "90ba71e0-639a-4e2b-bb44-67253fa41092",
      "employee_code": "DOC-9921",
      "staff_role": "DOCTOR",
      "status": "ACTIVE",
      "department_id": "a1195610-c1e1-450f-a39c-2ec03df6a925"
    },
    "temporaryPassword": "AutoGeneratedPassword123!"
  }
  ```

### 12.2 Staff Management & Status Deactivation
- `GET /admin/staff`: Lists all staff members with employment statuses and user profile details.
- `PATCH /admin/staff/:staffId`: Modifies employee code, role, or department.
- `PATCH /admin/staff/:staffId/status`: Updates staff status (`ACTIVE`, `INACTIVE`, `ON_LEAVE`). Setting status to `INACTIVE` automatically sets `users.is_active = false`, barring login.
- `GET /admin/doctors`: Lists all doctors with department allocations.
- `POST /admin/doctors`: Links doctor record to existing staff member.
- `GET /admin/patients`: Lists all hospital patient profiles.
