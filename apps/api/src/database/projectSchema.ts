const query = `

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE "user_role" AS ENUM ('PATIENT', 'STAFF', 'ADMIN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
        CREATE TYPE "staff_role" AS ENUM ('DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'RECEPTIONIST', 'BILLING_CLERK');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_status') THEN
        CREATE TYPE "staff_status" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
        CREATE TYPE "gender" AS ENUM ('Male', 'Female', 'Other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'specialization') THEN
        CREATE TYPE "specialization" AS ENUM ('Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery', 'Urology', 'Oncology', 'Orthopedics', 'General Medicine');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_type') THEN
        CREATE TYPE "visit_type" AS ENUM ('ONLINE', 'WALKIN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_status') THEN
        -- The patient's current stage in the journey — this is the field
        -- the whole "patient flow" UI and ETA logic reads from.
        CREATE TYPE "visit_status" AS ENUM (
            'REGISTERED', 'VITALS', 'WAITING_OPD', 'IN_CONSULTATION',
            'DIAGNOSTICS', 'PHARMACY', 'BILLING', 'COMPLETED', 'CANCELLED'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE "appointment_status" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type') THEN
        CREATE TYPE "appointment_type" AS ENUM ('CONSULTATION', 'FOLLOW_UP', 'PROCEDURE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
        CREATE TYPE "queue_status" AS ENUM ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_type') THEN
        CREATE TYPE "queue_type" AS ENUM ('APPOINTMENT', 'WALKIN', 'DIAGNOSTICS', 'PHARMACY', 'BILLING');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investigation_status') THEN
        CREATE TYPE "investigation_status" AS ENUM ('PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prescription_status') THEN
        CREATE TYPE "prescription_status" AS ENUM ('PENDING', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE "invoice_status" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- UTILITY: auto-update "updated_at" on row change
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- IDENTITY: one table for everyone who can log in
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    password        VARCHAR(255) NOT NULL,
    role            "user_role" NOT NULL DEFAULT 'PATIENT',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON "users";
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_role ON "users"(role);

-- ---------------------------------------------------------------------
-- DEPARTMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "departments" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) UNIQUE NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "departments" (name)
VALUES
    ('General Medicine'), ('Cardiology'), ('Dermatology'), ('Neurology'),
    ('Pediatrics'), ('Psychiatry'), ('Radiology'), ('Surgery'),
    ('Urology'), ('Oncology'), ('Orthopedics')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------
-- PATIENT PROFILE
-- Nullable user_id supports walk-ins registered by front-desk staff
-- who never create a login. If they later sign up, link the account.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "patient_profiles" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES "users"(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    date_of_birth   DATE NOT NULL,
    gender          "gender" NOT NULL,
    phone           VARCHAR(20),
    address         TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_patient_profiles_updated_at ON "patient_profiles";
CREATE TRIGGER trg_patient_profiles_updated_at BEFORE UPDATE ON "patient_profiles"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON "patient_profiles"(user_id);

-- ---------------------------------------------------------------------
-- STAFF PROFILE — the shared "ERP" identity for every non-patient role
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "staff_profiles" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
    employee_code   VARCHAR(100) UNIQUE NOT NULL,
    staff_role      "staff_role" NOT NULL,
    department_id   UUID REFERENCES "departments"(id) ON DELETE SET NULL,
    status          "staff_status" NOT NULL DEFAULT 'ACTIVE',
    joined_at       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON "staff_profiles";
CREATE TRIGGER trg_staff_profiles_updated_at BEFORE UPDATE ON "staff_profiles"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON "staff_profiles"(staff_role);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON "staff_profiles"(department_id);

-- Sub-role tables hold ONLY role-specific fields.
-- Name/email/password live in "users" — never duplicated here.
CREATE TABLE IF NOT EXISTS "doctors" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id            UUID UNIQUE NOT NULL REFERENCES "staff_profiles"(id) ON DELETE CASCADE,
    specialization      "specialization" NOT NULL,
    license_number      VARCHAR(100) UNIQUE,
    consultation_minutes INT NOT NULL DEFAULT 15,  -- avg slot length, useful for queue ETA math
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "nurses" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID UNIQUE NOT NULL REFERENCES "staff_profiles"(id) ON DELETE CASCADE,
    ward            VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pharmacists" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID UNIQUE NOT NULL REFERENCES "staff_profiles"(id) ON DELETE CASCADE,
    counter_number  VARCHAR(20),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "lab_technicians" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID UNIQUE NOT NULL REFERENCES "staff_profiles"(id) ON DELETE CASCADE,
    lab_section     VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON "doctors"(specialization);

-- ---------------------------------------------------------------------
-- APPOINTMENTS — pre-visit scheduling (before the patient physically
-- checks in). A visit is created at check-in time and links back here.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "appointments" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES "patient_profiles"(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES "doctors"(id) ON DELETE CASCADE,
    start_time      TIMESTAMP NOT NULL,
    end_time        TIMESTAMP NOT NULL,
    type            "appointment_type" NOT NULL DEFAULT 'CONSULTATION',
    status          "appointment_status" NOT NULL DEFAULT 'SCHEDULED',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_appointment_time CHECK (end_time > start_time)
);

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON "appointments";
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON "appointments"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time ON "appointments"(doctor_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON "appointments"(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON "appointments"(status);

-- ---------------------------------------------------------------------
-- VISITS — the backbone. One row per hospital visit; everything else
-- (vitals, consultation, orders, prescriptions, billing) hangs off this.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "visits" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL REFERENCES "patient_profiles"(id) ON DELETE CASCADE,
    appointment_id      UUID REFERENCES "appointments"(id) ON DELETE SET NULL,
    visit_type          "visit_type" NOT NULL DEFAULT 'WALKIN',
    status              "visit_status" NOT NULL DEFAULT 'REGISTERED',
    department_id       UUID REFERENCES "departments"(id) ON DELETE SET NULL,
    assigned_doctor_id  UUID REFERENCES "doctors"(id) ON DELETE SET NULL,
    registered_by       UUID REFERENCES "staff_profiles"(id) ON DELETE SET NULL,
    checked_in_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_visits_updated_at ON "visits";
CREATE TRIGGER trg_visits_updated_at BEFORE UPDATE ON "visits"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_visits_patient ON "visits"(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON "visits"(status);
CREATE INDEX IF NOT EXISTS idx_visits_department ON "visits"(department_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON "visits"(assigned_doctor_id);
-- Powers "today's active visits" dashboards
CREATE INDEX IF NOT EXISTS idx_visits_checked_in_at ON "visits"(checked_in_at);

-- ---------------------------------------------------------------------
-- VITALS — a real stage, not implied
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "vitals" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES "visits"(id) ON DELETE CASCADE,
    recorded_by     UUID REFERENCES "staff_profiles"(id) ON DELETE SET NULL,
    height_cm       NUMERIC(5,2),
    weight_kg       NUMERIC(5,2),
    blood_pressure  VARCHAR(20),      -- e.g. "120/80"
    temperature_c   NUMERIC(4,1),
    pulse_bpm       INT,
    spo2_percent    INT,
    recorded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vitals_visit ON "vitals"(visit_id);

-- ---------------------------------------------------------------------
-- QUEUE — single merged table, single status vocabulary
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "queue_entries" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES "visits"(id) ON DELETE CASCADE,
    department_id   UUID REFERENCES "departments"(id) ON DELETE SET NULL,
    doctor_id       UUID REFERENCES "doctors"(id) ON DELETE SET NULL,
    queue_type      "queue_type" NOT NULL DEFAULT 'WALKIN',
    priority        INT NOT NULL DEFAULT 0,   -- higher = seen sooner (e.g. emergency bump)
    status          "queue_status" NOT NULL DEFAULT 'WAITING',
    token_number    INT,                       -- display token, per department per day
    joined_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    called_at       TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_visit ON "queue_entries"(visit_id);
CREATE INDEX IF NOT EXISTS idx_queue_department_status ON "queue_entries"(department_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_doctor_status ON "queue_entries"(doctor_id, status);
-- Powers "next in line" ordering
CREATE INDEX IF NOT EXISTS idx_queue_status_priority_joined ON "queue_entries"(status, priority DESC, joined_at ASC);

-- ---------------------------------------------------------------------
-- CONSULTATION
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "consultations" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES "visits"(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES "doctors"(id) ON DELETE CASCADE,
    appointment_id  UUID REFERENCES "appointments"(id) ON DELETE SET NULL,
    diagnosis       TEXT NOT NULL,
    notes           TEXT,
    treatment_plan  TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_consultations_updated_at ON "consultations";
CREATE TRIGGER trg_consultations_updated_at BEFORE UPDATE ON "consultations"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_consultations_visit ON "consultations"(visit_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON "consultations"(doctor_id);

-- ---------------------------------------------------------------------
-- PRESCRIPTIONS + PHARMACY DISPENSING
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "prescriptions" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID REFERENCES "consultations"(id) ON DELETE SET NULL,
    visit_id        UUID NOT NULL REFERENCES "visits"(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES "doctors"(id) ON DELETE CASCADE,
    medication      VARCHAR(255) NOT NULL,
    dosage          VARCHAR(255) NOT NULL,
    frequency       VARCHAR(100),
    duration        VARCHAR(100),
    instructions    TEXT,
    status          "prescription_status" NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_prescriptions_updated_at ON "prescriptions";
CREATE TRIGGER trg_prescriptions_updated_at BEFORE UPDATE ON "prescriptions"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON "prescriptions"(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON "prescriptions"(status);

CREATE TABLE IF NOT EXISTS "pharmacy_dispenses" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES "prescriptions"(id) ON DELETE CASCADE,
    dispensed_by    UUID REFERENCES "staff_profiles"(id) ON DELETE SET NULL,
    quantity        VARCHAR(100),
    notes           TEXT,
    dispensed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispenses_prescription ON "pharmacy_dispenses"(prescription_id);

-- ---------------------------------------------------------------------
-- INVESTIGATION ORDERS (diagnostics)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "investigation_orders" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES "visits"(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES "doctors"(id) ON DELETE CASCADE,
    performed_by    UUID REFERENCES "staff_profiles"(id) ON DELETE SET NULL,
    test_name       VARCHAR(255) NOT NULL,
    instructions    TEXT,
    status          "investigation_status" NOT NULL DEFAULT 'PENDING',
    result          TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_investigation_orders_updated_at ON "investigation_orders";
CREATE TRIGGER trg_investigation_orders_updated_at BEFORE UPDATE ON "investigation_orders"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_investigations_visit ON "investigation_orders"(visit_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON "investigation_orders"(status);

-- ---------------------------------------------------------------------
-- BILLING
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "invoices" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES "visits"(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES "patient_profiles"(id) ON DELETE CASCADE,
    generated_by    UUID REFERENCES "staff_profiles"(id) ON DELETE SET NULL,
    total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
    status          "invoice_status" NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_visit ON "invoices"(visit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON "invoices"(status);

CREATE TABLE IF NOT EXISTS "invoice_items" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES "invoices"(id) ON DELETE CASCADE,
    description     VARCHAR(255) NOT NULL,
    item_type       VARCHAR(50) NOT NULL,   -- 'CONSULTATION' | 'TEST' | 'MEDICATION' | 'OTHER'
    amount          NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON "invoice_items"(invoice_id);

`;

export default query;