# Knowing Eye — Frontend

React + TypeScript SPA for the Knowing Eye examination platform. Connects to the Django API for auth, exams, live monitoring, and reports.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18, TypeScript |
| Build | Vite 6 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4, shadcn/Radix UI |
| Charts | Recharts |

## Quick start

From the repo root, use `start-dev.cmd` (starts API + UI), or run the frontend alone:

```powershell
cd frontend
npm install
copy .env.example .env.local   # optional — defaults to http://127.0.0.1:8000/api
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API must be running on port 8000.

## Project structure

```text
frontend/src/
├── core/           App shell: router, API client, auth/theme providers, env
├── features/       Feature-scoped hooks and API wrappers (auth, exams, reports, …)
├── pages/          Route-level screens
└── shared/         Reusable UI (shadcn), layout, hooks (e.g. use-monitoring)
```

### Key routes

| Path | Role | Purpose |
|------|------|---------|
| `/login` | — | JWT login |
| `/examiner` | Admin | Exam management dashboard |
| `/examinee` | Student | Available / completed exams |
| `/examinee/exam/:id` | Student | Live exam + monitoring |
| `/monitoring` | Admin | Active session list |
| `/monitoring/:sessionId` | Admin | Session inspector |
| `/reports` | Admin | Analytics + CSV export |
| `/profile` | Any | Profile & password |

Legacy paths (`/dashboard`, `/student/*`) redirect to the routes above.

## API client

All HTTP calls go through `src/core/config/api.ts` (`apiClient`). JWT tokens are stored in `localStorage` and attached automatically; refresh is handled on 401.

WebSocket monitoring URLs are built with `buildMonitoringWsUrl(sessionId)`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (HMR) |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve production build locally |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000/api` | REST base URL |
| `VITE_APP_NAME` | `Knowing Eye` | Display name |

## Further reading

- Root [README.md](../README.md) — full stack overview
- [REPOSITORY_GUIDE.md](../REPOSITORY_GUIDE.md) — repo map for new contributors
- [docs/deployment.md](../docs/deployment.md) — production build & deploy
