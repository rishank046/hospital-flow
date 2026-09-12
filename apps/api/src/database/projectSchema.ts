const query = `
CREATE TYPE IF NOT EXISTS "Gender" AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE IF NOT EXISTS "PatientType" AS ENUM ('Online', 'Walkin');
CREATE TYPE IF NOT EXISTS "QueueStatus" AS ENUM ('Pending', 'In Progress', 'Completed', 'Cancelled');
CREATE TYPE IF NOT EXISTS "specialization" AS ENUM ('Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery', 'Urology', 'Oncology', 'Orthopedics');
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Doctor" ( 
    id UUID PRIMARY KEY gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    specialization "specialization" NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    department VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Patient" (
    id UUID PRIMARY KEY gen_random_uuid(),
    owner_user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    gender "Gender" NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    patient_type "PatientType" NOT NULL,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Appointment" (
    id UUID PRIMARY KEY gen_random_uuid(),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Queue" (
    id UUID PRIMARY KEY gen_random_uuid(),
    date DATE NOT NULL,
    status "QueueStatus" NOT NULL,
    current_department VARCHAR(255) NOT NULL,
    patient_id UUID REFERENCES "Patient"(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES "Doctor"(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


`

export default query;