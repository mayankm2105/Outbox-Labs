# ReachInbox — Distributed Email Campaign Scheduler

A high-performance, fault-tolerant email campaign scheduling platform built with **Node.js, Express, TypeScript, BullMQ, Redis, PostgreSQL, Elasticsearch**, and **React 18 (Vite + Tailwind CSS)**.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
   - [How Scheduling Works](#how-scheduling-works)
   - [How Persistence on Restart is Handled](#how-persistence-on-restart-is-handled)
   - [How Rate Limiting & Concurrency are Implemented](#how-rate-limiting--concurrency-are-implemented)
2. [Features Implemented](#2-features-implemented)
   - [Backend Features](#backend-features)
   - [Frontend Features](#frontend-features)
3. [Ethereal Email Setup & Environment Variables](#3-ethereal-email-setup--environment-variables)
4. [How to Run the Backend](#4-how-to-run-the-backend)
5. [How to Run the Frontend](#5-how-to-run-the-frontend)
6. [Automated Tests & Quality Verification](#6-automated-tests--quality-verification)
7. [Deployment Guide (Render & Vercel)](#7-deployment-guide-render--vercel)

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          React 18 SPA (Vite)           │
                      │  Dashboard · Composer · Tables · Auth  │
                      └───────────────────┬────────────────────┘
                                          │ HTTP / REST (/api/v1)
                                          ▼
                      ┌────────────────────────────────────────┐
                      │          Express API Server            │
                      │  Validation · Idempotency · Auth Guard │
                      └───────┬──────────────────────┬─────────┘
                              │                      │
                  Write Outbox│                      │ Push Jobs
                              ▼                      ▼
            ┌───────────────────────────┐  ┌───────────────────────────┐
            │   PostgreSQL (Prisma)     │  │       Redis 7.0           │
            │ Users, Senders, Campaigns,│  │ BullMQ Delay Queues,      │
            │ Emails, Outbox, Events    │  │ Sliding-Window Rate Limit │
            └─────────────▲─────────────┘  └─────────────┬─────────────┘
                          │                              │
                          │ Read Outbox / State Update   │ Poll Delayed Jobs
                          │                              │
                      ┌───┴──────────────────────────────┴─────┐
                      │       BullMQ Email Worker Engine       │
                      │ Rate Check ──▶ Ethereal SMTP Provider  │
                      └───────────────────┬────────────────────┘
                                          │ Index Logs & Events
                                          ▼
                               ┌──────────────────────┐
                               │    Elasticsearch     │
                               │  Audit Trails & Logs │
                               └──────────────────────┘
```

### How Scheduling Works
1. **API Scheduling & Atomic Persistence:** When a user submits a campaign (`POST /api/v1/emails/schedule`), the backend creates the `Campaign` and individual `Email` records inside an atomic PostgreSQL database transaction along with corresponding `Outbox` entries (**Transactional Outbox Pattern**).
2. **Staggered Delay Calculation:** Each recipient in the campaign is allocated a discrete scheduled delivery timestamp:
   $$\text{scheduledAt}_i = \text{startAt} + (i \times \text{delaySeconds})$$
3. **Queue Enqueueing:** BullMQ delayed jobs are created for each email with a dynamic delay offset ($\text{delay} = \max(0, \text{scheduledAt}_i - \text{now()})$).
4. **Dispatch Lifecycle:** When a job triggers, the worker verifies that the campaign has not been cancelled, updates the email status to `PROCESSING`, enforces rate limits, and sends the message via Ethereal SMTP. Status transitions (`SCHEDULED` $\rightarrow$ `QUEUED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SENT` or `FAILED`) are immutably appended to `EmailEvent` and dual-indexed in Elasticsearch for real-time auditability.

### How Persistence on Restart is Handled
* **Dual-Layer Durability:** Email records and campaigns reside durably in PostgreSQL (Single Source of Truth), while BullMQ job manifests and timer keys are persisted in Redis with Append-Only File (AOF) / RDB snapshotting.
* **Worker Reboot Recovery (Reconciliation Worker):**
  - If a worker crashes mid-dispatch or Redis restarts, orphaned jobs in `PROCESSING` state or emails trapped in `Outbox` are reclaimed on startup.
  - The `reconciliation.worker.ts` scans for emails stuck in `SCHEDULED` or `PROCESSING` past their target timestamp and re-hydrates missing BullMQ jobs automatically without duplicate sends.
* **Idempotency Keys:** Mutating schedule endpoints accept an `Idempotency-Key` header stored in PostgreSQL. If network drops cause the client to retry, the server detects the cached response and does not double-enqueue dispatches.

### How Rate Limiting & Concurrency are Implemented
* **Distributed Sliding-Window Rate Limiter:**
  - Rate limits (both campaign-level `hourlyLimit` and system-wide `GLOBAL_HOURLY_LIMIT`) are enforced via Redis Sorted Sets (`ZSET`).
  - Each dispatch records a microsecond timestamp via `ZADD`. Before dispatching, the worker calls `ZREMRANGEBYSCORE` to purge events older than 3600 seconds ($T - 3600$) and evaluates `ZCARD`.
  - If the window is saturated, the job is not dropped; BullMQ delays and re-schedules it automatically for the next available slot.
* **Worker Concurrency:**
  - The worker engine utilizes decoupled worker processes (`email-sending.worker.ts`, `outbox.worker.ts`) configured with `EMAIL_WORKER_CONCURRENCY=5` (scalable across horizontal worker containers).

---

## 2. Features Implemented

### Backend Features
- [x] **Campaign & Email Scheduling Engine:** Transactional Outbox pattern, delay calculation, dynamic batch scheduling.
- [x] **Fault Tolerance & Persistence:** Crash-resilient reconciliation worker recovering trapped dispatches on system reboot.
- [x] **Sliding-Window Rate Limiting:** High-throughput Redis sorted-set rate limiting preventing SMTP provider throttling.
- [x] **Configurable Concurrency & Exponential Backoff:** Worker concurrency controls, automated retry policy for transient network/SMTP failures (`4xx`), dead-letter management for permanent failures (`5xx`).
- [x] **Idempotency Layer:** `Idempotency-Key` middleware protecting schedule mutations against double submissions.
- [x] **Audit Trail & Observability:** Immutably tracked `EmailEvent` lifecycle stored in PostgreSQL and mirrored to Elasticsearch.
- [x] **Session Authentication & Dev Impersonation:** Secure HTTP-only session cookies with `x-user-id` development bypass.
- [x] **BullMQ Admin Dashboard:** Live queue monitoring UI mounted at `/admin/queues`.

### Frontend Features
- [x] **Google OAuth Login View:** Responsive landing page with Google OAuth button and automated redirect logic.
- [x] **Live Metric Dashboard:** Real-time KPI stat cards (Scheduled, Sent, Failed, Active Campaigns) with automated 5-second polling during active queues.
- [x] **Compose New Campaign Modal:**
  - Multi-recipient parsing from raw text (supports commas, spaces, newlines).
  - CSV / TXT drag-and-drop file upload with immediate client-side validation.
  - Real-time deduplication with duplicate badges.
  - 60-second start-time grace window preventing validation errors due to form latency.
  - Inter-email delay (seconds) and hourly dispatch limit controls.
  - Automatic UUID v4 `Idempotency-Key` header injection.
- [x] **Server-Paginated Tables:** Filterable and paginated tabs for **Scheduled**, **Sent**, and **Failed** emails with search and date range pickers.
- [x] **Slide-Over Audit Trail Drawer:** Comprehensive email dispatch inspector with status breakdown, error codes, and chronological event timeline.
- [x] **Campaign Drill-Down & Delivery Progress:** Segmented multi-color progress bars showing live proportions of sent, failed, and pending emails, plus campaign cancellation controls.
- [x] **Sender Account Management:** Add and inspect SMTP sender credentials with zero password leakage in client state.
- [x] **Integrations & Live Status:** Header Slack webhook pill and real-time backend health pill (`/health`).

---

## 3. Ethereal Email Setup & Environment Variables

### Setting up Free Ethereal SMTP Credentials
Ethereal is a fake SMTP service used for safe testing.
1. Visit [https://ethereal.email/create](https://ethereal.email/create)
2. Click **Create Ethereal Account**.
3. Note your generated **Email address** and **Password**.
4. In your browser, keep [https://ethereal.email/messages](https://ethereal.email/messages) open to view outgoing test emails in real time!

---

### Backend Environment Variables (`backend/.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `PORT` | API Server port | `5001` |
| `FRONTEND_URL` | URL of the frontend application (for CORS) | `http://localhost:5173` |
| `API_BASE_URL` | Origin of the backend API server | `http://localhost:5001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://reachinbox:reachinbox@localhost:5434/reachinbox` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password (if any) | *(empty)* |
| `SESSION_SECRET` | 32+ character random secret for express-session | `reachinbox_super_secret_session_key_32chars` |
| `SESSION_TTL_SECONDS` | Session duration in seconds | `86400` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `mock-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `mock-google-client-secret` |
| `GOOGLE_CALLBACK_URL` | Google OAuth Redirect URI | `http://localhost:5001/api/v1/auth/google/callback` |
| `ETHEREAL_HOST` | Ethereal SMTP Host | `smtp.ethereal.email` |
| `ETHEREAL_PORT` | Ethereal SMTP Port | `587` |
| `ETHEREAL_USER` | Ethereal Username | *Your Ethereal email* |
| `ETHEREAL_PASSWORD` | Ethereal Password | *Your Ethereal password* |
| `ELASTICSEARCH_URL` | Elasticsearch cluster endpoint | `http://localhost:9200` |
| `EMAIL_WORKER_CONCURRENCY` | Number of simultaneous BullMQ jobs per worker | `5` |
| `GLOBAL_HOURLY_LIMIT` | System-wide maximum emails per hour | `100` |

---

### Frontend Environment Variables (`frontend/.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base API path (proxied in Vite to backend) | `/api/v1` |
| `VITE_BACKEND_URL` | Backend server URL | `http://localhost:5001` |
| `VITE_DEV_USER_ID` | Seeded test user ID for instant local dev login | `fcbceaa8-84b8-4cdf-8d8e-008906a02d8c` |

---

## 4. How to Run the Backend

### Step 1: Start Infrastructure Containers
From the project root:
```bash
docker compose up -d
```
*Starts PostgreSQL on port `5434`, Redis on port `6379`, and Elasticsearch on port `9200`.*

### Step 2: Install Dependencies & Run Database Migrations
```bash
cd backend
npm install
npx prisma migrate dev
```

### Step 3: Start the Backend API Server
```bash
npm run dev
```
*The Express API will boot on `http://localhost:5001`. You can test health via `curl http://localhost:5001/health`.*

### Step 4: Start the Background Worker Process
In a separate terminal window:
```bash
cd backend
npm run dev:worker
```
*The BullMQ worker will start listening for email dispatch and outbox reconciliation jobs.*

---

## 5. How to Run the Frontend

```bash
cd frontend
npm install
npm run dev -- --host
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.
*With `VITE_DEV_USER_ID` configured in `frontend/.env`, you will immediately enter the live dashboard.*

---

## 6. Automated Tests & Quality Verification

### Run Backend Unit & Integration Tests (Vitest)
```bash
cd backend
npm run test
```
*Runs all 14 test suites (60 tests) covering scheduling transactions, sliding-window rate limiters, crypto encryption, and error classifications.*

### Run Frontend Component & Utility Tests (Vitest)
```bash
cd frontend
npm run test
```
*Runs 6 test suites (18 tests) covering input validation, CSV parsing, status styling, progress bar divisions, composer duplicate detection, and table empty/error states.*

### Build Type Check
```bash
# Backend build check
cd backend && npm run build

# Frontend build check
cd frontend && npm run build
```

---

## 7. Deployment Guide (Render & Vercel)

### Deploy Backend on Render
1. Create a **PostgreSQL Database** on Render (Plan: Free) and copy the connection string.
2. Create a **Web Service** connected to `https://github.com/mayankm2105/Outbox-Labs`.
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build && npx prisma migrate deploy`
   - **Start Command:** `npm run start:all` *(runs both Express API and BullMQ worker together!)*
   - Add environment variables matching the table in Section 3.

### Deploy Frontend on Vercel
1. Import repository on [Vercel](https://vercel.com/new).
2. Set **Root Directory** to `frontend`.
3. Add Environment Variables:
   - `VITE_API_BASE_URL`: `https://<YOUR-RENDER-BACKEND-URL>/api/v1`
   - `VITE_BACKEND_URL`: `https://<YOUR-RENDER-BACKEND-URL>`
   - `VITE_DEV_USER_ID`: `fcbceaa8-84b8-4cdf-8d8e-008906a02d8c`
4. Deploy! The pre-configured `frontend/vercel.json` ensures full SPA routing without 404s.
