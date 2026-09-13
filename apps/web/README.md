# Hospital Flow Web Application (`apps/web`)

Hospital Flow Web is the clinical frontend interface built with **React 19**, **TypeScript**, and **Vite**, connecting to the modular Hospital Flow REST & WebSocket backend.

---

## 🚀 Live Backend Integration

The frontend connects to the live backend hosted on Render:

- **API Base URL:** `https://hospital-flow-l825.onrender.com`
- **Configured via:** `VITE_API_BASE_URL` in `.env`
- **Default fallback:** Configured in `src/services/api.client.ts` to automatically target the live Render instance if `.env` is omitted.

---

## 👥 Role Portals & Route Map

| Role / Scope | Route | Description |
| :--- | :--- | :--- |
| **Public** | `/login` or `/` | Patient & Physician authentication |
| **Public** | `/register` | Patient self-registration |
| **Public** | `/doctor/login` | Dedicated physician login |
| **Patient** | `/patient/dashboard` | Clinical overview, next appointment, and stats |
| **Patient** | `/patient/appointments` | Appointment scheduling, list, and cancellation |
| **Patient** | `/patient/journey` | Chronological care progression timeline |
| **Patient** | `/patient/records` | Past consultations, prescriptions, and lab reports |
| **Patient** | `/patient/profile` | Personal medical demographics & care pathway |
| **Doctor** | `/doctor/dashboard` | Physician workload overview and today's schedule |
| **Doctor** | `/doctor/schedule` | Assigned appointment roster |
| **Doctor** | `/doctor/patients` | Assigned patient roster and search |
| **Doctor** | `/doctor/patients/:id` | Patient clinical chart, consultation builder, and lab orders |

---

## 🛠️ Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Default `.env` targets the live backend:
```env
VITE_API_BASE_URL=https://hospital-flow-l825.onrender.com
```

### 3. Start Development Server
```bash
npm run dev
```
Listens on `http://localhost:5173`.

---

## 🛡️ Verification & Build Commands

```bash
# Typecheck and production bundle build
npm run build

# Run ESLint (React 19 & Hooks rules)
npm run lint

# Preview built application
npm run preview
```
