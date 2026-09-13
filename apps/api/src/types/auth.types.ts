export type SystemRole = "USER" | "STAFF" | "ADMIN";

export type StaffRole =
    | "DOCTOR"
    | "NURSE"
    | "RECEPTIONIST"
    | "LAB_STAFF"
    | "PHARMACIST";

export type StaffStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE";

export interface AuthPayload {
    userId: string;
    email: string;
    role: SystemRole;
    staffRole?: StaffRole | undefined;
}
