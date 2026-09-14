export type SystemRole = "PATIENT" | "STAFF" | "ADMIN" | "USER";

export type StaffRole =
    | "DOCTOR"
    | "OPD_MANAGER"
    | "NURSE"
    | "PHARMACIST"
    | "LAB_TECH"
    | "RECEPTIONIST"
    | "BILLING_CLERK"
    | "LAB_STAFF";

export type StaffStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE";

export interface AuthPayload {
    userId: string;
    email: string;
    role: SystemRole;
    staffRole?: StaffRole | null | undefined;
}

