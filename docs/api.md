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

### Login

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

The token creation logic is not finished yet. The final token format and expiry are **Not decided yet**.

### Other authentication endpoints

The routes exist, but their behavior and payloads are **Not decided yet**:

| Method | Endpoint | Payload |
| --- | --- | --- |
| `POST` | `/auth/register` | **Not decided yet** |
| `POST` | `/auth/logout` | **Not decided yet** |
| `POST` | `/auth/refresh` | **Not decided yet** |
| `POST` | `/auth/forgot-password` | `{ "email": "patient@example.com" }` |
| `POST` | `/auth/reset-password` | `{ "token": "uuid", "password": "newpassword" }` |

## Patient endpoints

All patient endpoints require authentication and the `PATIENT` role. Authentication middleware is not implemented yet, so these endpoints currently return `501`. Payloads marked **Not decided yet** still need an agreed frontend contract.

| Method | Endpoint | Payload |
| --- | --- | --- |
| `GET` | `/patients/me` | None |
| `PATCH` | `/patients/me` | **Not decided yet** |
| `GET` | `/patients/me/appointments` | None |
| `POST` | `/patients/appointments` | **Not decided yet** |
| `DELETE` | `/patients/appointments/:appointmentId` | None |
| `GET` | `/patients/me/queue` | None |
| `GET` | `/patients/me/journey` | None |
| `GET` | `/patients/me/consultations` | None |
| `GET` | `/patients/me/reports` | None |
| `GET` | `/patients/me/prescriptions` | None |

## Doctor endpoints

All doctor endpoints require authentication and the `DOCTOR` role. The controllers and authentication middleware are not implemented yet, so these endpoints currently return `501`.

| Method | Endpoint | Payload |
| --- | --- | --- |
| `POST` | `/doctors/login` | **Not decided yet** |
| `GET` | `/doctors/me` | None |
| `PATCH` | `/doctors/me` | **Not decided yet** |
| `GET` | `/doctors/me/schedule` | None |
| `GET` | `/doctors/me/queue` | None |
| `GET` | `/doctors/me/patients` | None |
| `GET` | `/doctors/patients/:patientId` | None |
| `POST` | `/doctors/patients/:patientId/consultation` | **Not decided yet** |
| `PATCH` | `/doctors/consultations/:consultationId` | **Not decided yet** |
| `POST` | `/doctors/patients/:patientId/orders` | **Not decided yet** |
| `GET` | `/doctors/patients/:patientId/reports` | None |
| `POST` | `/doctors/queue/:queueEntryId/complete` | **Not decided yet** |
| `POST` | `/doctors/queue/:queueEntryId/skip` | **Not decided yet** |

## Sending the token

The final authentication format is **Not decided yet**. The expected frontend request pattern will likely be:

```ts
const response = await fetch(`${API_URL}/patients/me`, {
	headers: {
		Authorization: `Bearer ${token}`,
	},
});
```

Do not depend on protected endpoints until authentication middleware and role authorization are implemented.

## Current status codes

| Status | Meaning |
| --- | --- |
| `200` | Request succeeded, where implemented |
| `501` | Endpoint or authentication middleware is not implemented yet |
| `400` | Request validation failed; exact error response is **Not decided yet** |
