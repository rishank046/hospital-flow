# Hospital Flow

Hospital Flow is a modern clinical management and patient workflow platform built with a modular Node.js/Express/PostgreSQL backend and a React/TypeScript/Vite frontend.

---

## 👥 Team & Repository Structure

The project is developed by a 5-member team divided into two specialized tracks:

```text
hospital-flow/
├── apps/
│   ├── api/                   # Backend API (Express 5, Node ESM, TypeScript, PostgreSQL)
│   │   └── AI-Instructions.md # Strict AI guidelines, 4-tier modular pattern, security mandates
│   └── web/                   # Frontend Web App (React 19, TypeScript, Vite)
│       └── AI-Instructions.md # Strict AI guidelines, component hierarchy, service client layer
├── docs/                      # Architectural decisions and API specifications
│   ├── api.md                 # Complete HTTP endpoint contracts
│   └── decisions.md           # Architecture Decision Records (ADRs)
└── docker-compose.yml
```

---

## 🤖 AI Development Guidelines for Team Members

Because team members leverage AI coding assistants (ChatGPT, Claude, Cursor, GitHub Copilot, Antigravity) to build features, **strict instruction files have been created in each workspace**:

- **Backend Team (`apps/api`):** Refer to and attach [`apps/api/AI-Instructions.md`](apps/api/AI-Instructions.md).
- **Frontend Team (`apps/web`):** Refer to and attach [`apps/web/AI-Instructions.md`](apps/web/AI-Instructions.md).

### How to Use These Files with AI Tools

1. **Cursor / Windsurf:**
   - In the chat prompt, type `@AI-Instructions.md` before describing the task.
   - Or configure it as a rule in `.cursorrules` / `.cursor/rules/`.
2. **Claude Projects / Custom GPTs:**
   - Upload `AI-Instructions.md` to your Project Knowledge or set it as the System Prompt.
3. **ChatGPT / Claude / Copilot Chat:**
   - Attach or paste the contents of `AI-Instructions.md` into the conversation context so the model adheres to project folder structures and security rules.

---

## 🚀 Getting Started

### Backend (`apps/api`)
```bash
cd apps/api
cp .env.example .env
# Generate a strong JWT secret and paste it into JWT_SECRET in .env
openssl rand -hex 32
npm install
npm run dev
```
Runs on `http://localhost:3000`.

### Frontend (`apps/web`)
```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```
Runs on `http://localhost:5173`.

---

## 🛡️ Verification & Quality Checks

Run these commands before submitting pull requests:

```bash
# Typecheck backend
./apps/api/node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit

# Run backend tests
npm --prefix apps/api test

# Typecheck and build frontend
npm --prefix apps/web run build

# Lint frontend
npm --prefix apps/web run lint
```
