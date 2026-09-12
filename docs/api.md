# Hospital Flow API

This document explains how the frontend can call the API. Use JSON request bodies and include the `Content-Type` header for requests with a body.

## Base URL

When running locally, the API listens on:

```text
http://localhost:3000
```

Example frontend helper:

```ts
const API_URL = "http://localhost:3000";

const response = await fetch(`${API_URL}/auth/login`, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		email: "patient@example.com",
		password: "password123",
	}),
});

const data = await response.json();
```

## Authentication

### Patient registration

`POST /auth/register`

Request payload:

```json
{
	"name": "John Connor",
	"email": "patient@example.com",
	"password": "password123"
}
```

The name must not be empty, the email must be valid, and the password must contain at least 6 characters. Registration creates a user and then logs that user in, returning the same token response as login.

### Patient login

`POST /auth/login`

Request payload:

```json
{
	"email": "patient@example.com",
	"password": "password123"
}
```

The email must be valid and the password must contain at least 6 characters.

Current response shape:

```json
{
	"token": "replace-with-token"
}
```

The token expires after 4 hours. It is a signed JWT containing the patient user ID, email, and `PATIENT` role.

### Logout

`POST /auth/logout`

Requires a bearer token. The token is revoked until its original expiry time.

Response:

```json
{
	"message": "Logged out successfully"
}
```

### Other authentication endpoints

The following routes are registered but not implemented yet:

| Method | Endpoint | Payload | Status |
| --- | --- | --- |
| `POST` | `/auth/refresh` | Not implemented | `501` |
| `POST` | `/auth/forgot-password` | `{ "email": "patient@example.com" }` | `501` |
| `POST` | `/auth/reset-password` | `{ "token": "uuid", "password": "newpassword" }` | `501` |

## Patient endpoints

All patient endpoints require a bearer token and the `PATIENT` role. A token with the legacy `USER` role is also accepted for patient endpoints.

| Method | Endpoint | Payload | Status |
| --- | --- | --- |
| `GET` | `/patients/me` | None | `200` |
| `PATCH` | `/patients/me` | See profile update below | `200` |
| `GET` | `/patients/me/appointments` | None | `200` |
| `POST` | `/patients/appointments` | See appointment booking below | `201` |
| `DELETE` | `/patients/appointments/:appointmentId` | None | `200` |
| `GET` | `/patients/me/queue` | None | `501` |
| `GET` | `/patients/me/journey` | None | `200` |
| `GET` | `/patients/me/consultations` | None | `200` |
| `GET` | `/patients/me/reports` | None | `200` |
| `GET` | `/patients/me/prescriptions` | None | `200` |

Patient profile update:

```json
{
	"name": "John Connor",
	"age": 36,
	"gender": "Male",
	"patientType": "Online",
	"doctorId": "doctor-uuid"
}
```

All fields are optional. `gender` is `Male`, `Female`, or `Other`; `patientType` is `Online` or `Walkin`.

Appointment booking:

```json
{
	"doctorId": "doctor-uuid",
	"startTime": "2026-09-13T10:00:00.000Z",
	"endTime": "2026-09-13T10:30:00.000Z"
}
```

Both timestamps must be valid ISO datetime strings, the end must be after the start, and the doctor must not already have an overlapping appointment. Conflicts return `409`.

## Doctor endpoints

Doctor login does not require an existing token. All other implemented doctor endpoints require a bearer token with the `DOCTOR` role.

| Method | Endpoint | Payload | Status |
| --- | --- | --- |
| `POST` | `/doctors/login` | `{ "email": "doctor@example.com", "password": "password123" }` | `200` |
| `GET` | `/doctors/me` | None | `200` |
| `PATCH` | `/doctors/me` | See doctor profile update below | `200` |
| `GET` | `/doctors/me/schedule` | None | `200` |
| `GET` | `/doctors/me/queue` | None | `501` |
| `GET` | `/doctors/me/patients` | None | `200` |
| `GET` | `/doctors/patients/:patientId` | None | `200` |
| `POST` | `/doctors/patients/:patientId/consultation` | See consultation below | `201` |
| `PATCH` | `/doctors/consultations/:consultationId` | See consultation update below | `200` |
| `POST` | `/doctors/patients/:patientId/orders` | See investigation order below | `201` |
| `GET` | `/doctors/patients/:patientId/reports` | None | `200` |
| `POST` | `/doctors/queue/:queueEntryId/complete` | Not implemented | `501` |
| `POST` | `/doctors/queue/:queueEntryId/skip` | Not implemented | `501` |

Doctor profile update:

```json
{
	"name": "Dr. Sarah Connor",
	"specialization": "Cardiology",
	"department": "Cardiology Department"
}
```

All fields are optional. Specialization must be one of the values defined by the doctor schema, such as `Cardiology`, `Neurology`, or `Pediatrics`.

Create consultation:

```json
{
	"appointmentId": "appointment-uuid",
	"diagnosis": "Mild hypertension",
	"notes": "Patient reported occasional dizziness",
	"treatmentPlan": "Monitor BP twice daily",
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

Only `diagnosis` is required. Creating a consultation also creates any supplied prescriptions.

Consultation update:

```json
{
	"diagnosis": "Updated diagnosis",
	"notes": "Updated clinical notes",
	"treatmentPlan": "Updated treatment plan"
}
```

Investigation order:

```json
{
	"testName": "Complete blood count",
	"instructions": "Fasting sample"
}
```

`testName` is required. New investigation orders start with `PENDING` status.

## Sending the token

Send the JWT in the `Authorization` header for protected endpoints:

```ts
const response = await fetch(`${API_URL}/patients/me`, {
	headers: {
		Authorization: `Bearer ${token}`,
	},
});
```

Missing or invalid tokens return `401`. A valid token with the wrong role returns `403`. A revoked token also returns `401`.

## Current status codes

| Status | Meaning |
| --- | --- |
| `200` | Request succeeded, where implemented |
| `201` | Resource created successfully |
| `400` | Request validation failed or business rule rejected the request |
| `401` | Authentication is missing, invalid, expired, or revoked |
| `403` | Authenticated user does not have the required role or ownership |
| `404` | Requested user, doctor, patient, or appointment was not found |
| `409` | Appointment time conflicts with an existing appointment |
| `501` | Queue or unfinished authentication endpoint |

Errors are returned as JSON:

```json
{
	"message": "Human-readable error message"
}
```
