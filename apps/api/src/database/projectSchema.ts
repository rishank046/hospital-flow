const query = `
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
        CREATE TYPE "Gender" AS ENUM ('Male', 'Female', 'Other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientType') THEN
        CREATE TYPE "PatientType" AS ENUM ('Online', 'Walkin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QueueStatus') THEN
        CREATE TYPE "QueueStatus" AS ENUM ('Pending', 'In Progress', 'Completed', 'Cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'specialization') THEN
        CREATE TYPE "specialization" AS ENUM ('Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery', 'Urology', 'Oncology', 'Orthopedics');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'USER';

CREATE TABLE IF NOT EXISTS "Admin" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Department" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Department" (name)
VALUES 
    ('General Medicine'),
    ('Cardiology'),
    ('Dermatology'),
    ('Neurology'),
    ('Pediatrics'),
    ('Psychiatry'),
    ('Radiology'),
    ('Surgery'),
    ('Urology'),
    ('Oncology'),
    ('Orthopedics')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS "Staff" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    employee_code VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Doctor" ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE,
    department_id UUID REFERENCES "Department"(id) ON DELETE SET NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255),
    specialization "specialization" NOT NULL,
    department VARCHAR(255),
    license_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS staff_id UUID UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES "Department"(id) ON DELETE SET NULL;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS license_number VARCHAR(100);
ALTER TABLE "Doctor" ALTER COLUMN name DROP NOT NULL;
ALTER TABLE "Doctor" ALTER COLUMN email DROP NOT NULL;
ALTER TABLE "Doctor" ALTER COLUMN password DROP NOT NULL;
ALTER TABLE "Doctor" ALTER COLUMN department DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "Patient" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    gender "Gender" NOT NULL,
    patient_type "PatientType" NOT NULL DEFAULT 'Online',
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Appointment" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'CONSULTATION',
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'CONSULTATION';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED';

CREATE TABLE IF NOT EXISTS "Consultation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES "Appointment"(id) ON DELETE SET NULL,
    diagnosis TEXT NOT NULL,
    notes TEXT,
    treatment_plan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Prescription" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID REFERENCES "Consultation"(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    medication VARCHAR(255) NOT NULL,
    dosage VARCHAR(255) NOT NULL,
    frequency VARCHAR(100),
    duration VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "InvestigationOrder" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    instructions TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    result TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "QueueEntry" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    department_id UUID REFERENCES "Department"(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES "Appointment"(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'APPOINTMENT',
    priority INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'WAITING',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_time TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Queue" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    status "QueueStatus" NOT NULL,
    current_department VARCHAR(255) NOT NULL,
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

export default query;
