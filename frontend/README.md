# ReachInbox Frontend

Production SPA for **ReachInbox** — an email campaign scheduling system built with React 18, TypeScript, Vite, Tailwind CSS v3.4, and TanStack React Query v5. Connects to the Express + PostgreSQL + BullMQ + Redis + Elasticsearch backend.

---

## 1. Quick Start

### Prerequisites
- Node.js 18+ (tested on Node 20 / 22)
- Running ReachInbox backend API server (defaulting to `http://localhost:5001`)

### Installation & Execution
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server with HMR and API proxy
npm run dev

# Run Vitest test suite
npm run test

# Type-check and production build
npm run build

# Preview production build locally
npm run preview
```

The Vite dev server starts at `http://localhost:5173`.

---

## 2. Environment Variables

Create `.env` in `frontend/` (template provided in `.env.example`):

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base path for REST API endpoints (proxied by Vite in dev to backend) | `/api/v1` |
| `VITE_BACKEND_URL` | Full URL of the ReachInbox backend server (used for OAuth redirects and Bull Board links) | `http://localhost:5001` |
| `VITE_DEV_USER_ID` | Seeded development user ID sent via `x-user-id` header when Google OAuth cookie is not present in local dev environments | `fcbceaa8-84b8-4cdf-8d8e-008906a02d8c` |

---

## 3. Architecture & Key Design Decisions

### 3.1 Authentication & Dev Mode
- **Production Mode:** Full-page browser navigation redirects to `${VITE_BACKEND_URL}/auth/google`. The backend issues a secure, `httpOnly` session cookie (`connect.sid`). The frontend HTTP client uses `withCredentials: true` so all requests automatically pass the cookie.
- **Development Mode:** When `VITE_DEV_USER_ID` is set, `src/api/client.ts` automatically attaches `x-user-id: <DEV_USER_ID>` on outgoing requests, allowing end-to-end testing and development without requiring Google OAuth credentials locally.
- **Security:** In strict adherence to constraints, no session tokens or passwords are ever stored in `localStorage` or `sessionStorage`.

### 3.2 Server State Management (TanStack Query v5)
- All remote data is cached and managed via React Query.
- Active campaigns and queued email tables automatically poll (`refetchInterval: 5000`) while campaigns are in `PENDING` or `PROCESSING` states, and deactivate polling once all dispatches terminate.
- Invalidation cascades keep stats cards, campaign progress bars, and email tables in sync after mutations (`scheduleCampaign`, `cancelCampaign`, `createSender`).

### 3.3 Form Handling & Resilient Validation
- Controlled components without heavyweight schema libraries.
- Client-side validation runs live with responsive debounce (200ms) for recipient text areas and file uploads.
- **Grace window:** Accepts schedule timestamps within 60 seconds in the past to compensate for form fill delay or network clock skew.
- **Duplicate handling:** Client deduplicates recipients in real-time, displays duplicate count badges, and handles backend deduplication metadata.
- **Idempotency:** Every compose request generates a UUID v4 `Idempotency-Key` attached to the headers, preventing accidental double submissions on rapid clicks.

### 3.4 Strict Design Token System (Tailwind CSS v3.4)
- Encoded in `tailwind.config.js` and `src/index.css`.
- Neutral Slate (`#0f172a`, `#334155`, `#64748b`), Primary Indigo (`#4f46e5`, `#4338ca`), and semantic status colors:
  - Scheduled / Pending: Sky / Blue
  - Processing: Amber / Yellow
  - Completed / Sent: Emerald / Green
  - Failed: Rose / Red
  - Cancelled: Slate / Neutral

---

## 4. Features Mapped to Brief

- **Google OAuth Login (`/login`):** Landing page with Google button; auto-redirects if already authenticated.
- **Main Dashboard (`/dashboard`):** 
  - Summary metric cards (Total Scheduled, Sent, Failed, Active Campaigns).
  - Quick action "Compose New Email" button opening `ScheduleModal`.
  - Filterable tabs for **Scheduled**, **Sent**, and **Failed** emails.
- **Compose New Email Modal (`ScheduleModal`):**
  - Sender account selection.
  - Multi-recipient parsing from raw text (commas, spaces, newlines).
  - CSV / TXT drag-and-drop / file picker upload with live deduplication count.
  - Custom start time (local timezone mapped to UTC ISO-8601).
  - Delay between emails (seconds) and Hourly limit rate settings.
- **Campaigns View (`/campaigns`):**
  - List of all campaigns with live segmented progress bars (`sent`, `failed`, `pending`).
  - Campaign cancellation action (calls `DELETE /campaigns/:id`).
  - Campaign Detail modal with email dispatch drill-down.
- **Email Detail & Audit Trail (`EmailDetailDrawer`):**
  - Drawer sliding from right with complete recipient and campaign details.
  - Interactive event timeline rendering all status transition events (`SCHEDULED`, `QUEUED`, `PROCESSING`, `SENT`, `FAILED`).
- **Sender Account Management (`/senders`):**
  - List configured SMTP sender identities.
  - Add sender modal with secure password submission (cleared from memory immediately after submission).
- **Slack Integration Control:**
  - Connect/Disconnect/Test notification webhook with status badge in the header.
- **Backend Health Pill:**
  - Real-time indicator in the navigation bar probing `/health`.

---

## 5. Folder Structure

```
frontend/
├── src/
│   ├── api/                 # Axios instance and domain-specific endpoints
│   │   ├── client.ts        # Axios client with interceptors and unwrap logic
│   │   ├── auth.api.ts
│   │   ├── campaigns.api.ts
│   │   ├── emails.api.ts
│   │   ├── health.api.ts
│   │   ├── integrations.api.ts
│   │   └── senders.api.ts
│   ├── components/
│   │   ├── common/          # Atomic UI primitives (Button, Modal, Input, Badge, etc.)
│   │   ├── campaigns/       # CampaignCard, CampaignList, ScheduleModal, DetailModal
│   │   ├── emails/          # EmailTable, EmailFilters, EmailDetailDrawer, EventTimeline
│   │   ├── integrations/    # SlackControl
│   │   ├── layout/          # AppShell, Navbar, Sidebar
│   │   └── senders/         # SenderList, AddSenderModal
│   ├── context/             # ToastContext
│   ├── hooks/               # Custom React Query & UI hooks
│   ├── pages/               # Route views (LoginPage, DashboardPage, CampaignsPage, SendersPage)
│   ├── types/               # TypeScript interfaces and status enums matching API contracts
│   ├── utils/               # Status styling, date formatting, CSV parsing, validation
│   └── test/                # Vitest unit and component tests
├── index.html
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 6. Verification and Test Results

Run all automated unit and component tests:
```bash
npm run test
```

### Test Coverage Summary:
- `validation.util.test.ts` (5 tests): Email regex, subject/body requirements, delay seconds bounds, hourly limits, past start time grace window.
- `csv.util.test.ts` (1 test): CSV/TXT header filtering, whitespace stripping, and email deduplication.
- `status.util.test.ts` (2 tests): Campaign and email status color styles and human-readable badge labels.
- `ProgressBar.test.tsx` (2 tests): Empty progress bar (zero-division safe) and proportional multi-state campaign bars.
- `ScheduleModal.test.tsx` (4 tests): Form open render, live recipient text parsing, duplicate address detection, 60-second past start time enforcement.
- `EmailTable.test.tsx` (4 tests): Loading skeleton state, empty list state, populated rows with status styling and row drill-down click handlers, error state.

**Result: 6 test suites, 18 tests passing.**

