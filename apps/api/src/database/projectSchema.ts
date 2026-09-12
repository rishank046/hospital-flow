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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Doctor" ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    specialization "specialization" NOT NULL,
    department VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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