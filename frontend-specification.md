# ReachInbox — Frontend Architecture, Component Structure & API Integration Specification

**Project:** ReachInbox Email Scheduler  
**Document Type:** Frontend Architecture & AI Agent Implementation Blueprint  
**Tech Stack:** React 18+, TypeScript, Vite, Tailwind CSS, Lucide Icons, Axios / Fetch  
**Target Backend:** Express API (`http://localhost:5001/api/v1`)  
**Authentication:** Cookie-based Session (`credentials: 'include'`) + Dev header fallback (`x-user-id`)

---

# 1. System Overview & UI Requirements

The frontend is a single-page application (SPA) built for managing, scheduling, and monitoring email campaigns. It provides a clean, modern interface with real-time feedback, status tracking, and error inspection.

### Key Capabilities:
1. **User Authentication:** Google OAuth login, user profile header, and logout.
2. **Campaign Composer / Scheduler:** Compose email subject and body, enter recipient lists (comma/newline separated), select future date/time, configure inter-email delay (in seconds), configure hourly sending limit, and select active sender identity.
3. **Campaigns Management:** List campaigns with pagination, view delivery progress bars (e.g., Sent vs Failed vs Pending), inspect campaign details, and cancel pending campaigns.
4. **Email Records Explorer:** Tabbed views for:
   - **Scheduled:** Pending emails with planned delivery timestamps.
   - **Sent:** Delivered emails with provider message IDs and Ethereal preview links.
   - **Failed:** Failed emails with raw error codes (e.g. `SMTP_535`, `SMTP_550`) and error descriptions.
5. **Audit Trail Modal:** View lifecycle event history for any individual email (`CREATED` → `SCHEDULED` → `PROCESSING` → `SENT` / `FAILED`).
6. **Sender Accounts Configuration:** Manage Ethereal SMTP sender identities.

---

# 2. Backend API Configuration

### Base URL:
```env
VITE_API_BASE_URL=http://localhost:5001/api/v1
```

### Authentication & Headers:
* **Cookies:** All requests must include credentials (`credentials: 'include'` in Fetch, or `withCredentials: true` in Axios).
* **Development Header:** For testing without Google OAuth in development, pass:
  ```http
  x-user-id: <user-uuid>
  ```
  *(Default seeded demo user: `fcbceaa8-84b8-4cdf-8d8e-008906a02d8c`)*
* **Idempotency Header:** When scheduling a campaign, generate a unique UUID:
  ```http
  Idempotency-Key: <unique-client-uuid>
  ```

---

# 3. Exact API Contracts

### Standard Response Envelope:
```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": {}
}
```

### Standard Error Envelope (HTTP 4xx / 5xx):
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": []
  }
}
```

---

## 3.1 Health & Authentication APIs

### `GET /health`
* **URL:** `http://localhost:5001/health`
* **Response:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-03T17:13:55.374Z",
    "postgres": "ok",
    "redis": "ok",
    "elasticsearch": "ok"
  }
  ```

### `GET /api/v1/auth/me`
* **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "fcbceaa8-84b8-4cdf-8d8e-008906a02d8c",
      "name": "Demo User",
      "email": "demo@reachinbox.com",
      "role": "USER",
      "avatarUrl": null
    }
  }
  ```

### `POST /api/v1/auth/logout`
* **Response (200):**
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

---

## 3.2 Senders APIs

### `GET /api/v1/senders`
* **Response (200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "63aee0a6-64b3-46d3-90e3-af72de447b20",
        "userId": "fcbceaa8-84b8-4cdf-8d8e-008906a02d8c",
        "email": "sender@reachinbox.com",
        "displayName": "ReachInbox Sender",
        "smtpHost": "smtp.ethereal.email",
        "smtpPort": 587,
        "isActive": true,
        "createdAt": "2026-11-03T17:15:36.000Z"
      }
    ]
  }
  ```

### `POST /api/v1/senders`
* **Body:**
  ```json
  {
    "email": "myethereal@ethereal.email",
    "displayName": "My Sender",
    "smtpHost": "smtp.ethereal.email",
    "smtpPort": 587,
    "smtpUsername": "user@ethereal.email",
    "smtpPassword": "mypassword"
  }
  ```
* **Response (201):**
  ```json
  {
    "success": true,
    "message": "Sender account created successfully",
    "data": {
      "id": "sender-uuid",
      "email": "myethereal@ethereal.email",
      "displayName": "My Sender",
      "smtpHost": "smtp.ethereal.email",
      "smtpPort": 587,
      "isActive": true,
      "createdAt": "2026-11-03T17:15:36.000Z"
    }
  }
  ```

---

## 3.3 Email Scheduling & Campaign APIs

### `POST /api/v1/emails/schedule`
* **Headers:**
  ```http
  Content-Type: application/json
  Idempotency-Key: <unique-uuid>
  ```
* **Body:**
  ```json
  {
    "senderAccountId": "63aee0a6-64b3-46d3-90e3-af72de447b20",
    "subject": "Product Launch Announcement",
    "body": "Hello! Welcome to our new release.",
    "recipients": [
      "john@example.com",
      "sarah@example.com",
      "alex@example.com"
    ],
    "startAt": "2026-11-04T10:00:00.000Z",
    "delaySeconds": 10,
    "hourlyLimit": 50
  }
  ```
* **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "message": "Campaign scheduled successfully",
    "data": {
      "campaignId": "0a71fe6c-b173-4bd9-8114-c336d32bcef0",
      "totalRecipients": 3,
      "deduplicatedCount": 0,
      "status": "SCHEDULED",
      "scheduledCount": 3
    }
  }
  ```
* **Important UI Handling:**
  - If `deduplicatedCount > 0`, display a notification banner: *"Removed X duplicate recipient(s) automatically."*
  - **Grace Window:** Timestamps up to 60 seconds in the past are accepted by backend and treated as immediate scheduling.
  - If rejected with `START_TIME_IN_PAST`, show: *"Start time must be in the future or within the allowed 60-second grace window."*

---

### `GET /api/v1/campaigns`
* **Query Parameters:** `page=1&limit=10`
* **Response (200):**
  ```json
  {
    "success": true,
    "message": "Campaigns retrieved successfully",
    "data": {
      "items": [
        {
          "id": "0a71fe6c-b173-4bd9-8114-c336d32bcef0",
          "subject": "Product Launch Announcement",
          "body": "Hello! Welcome to our new release.",
          "startAt": "2026-11-04T10:00:00.000Z",
          "delaySeconds": 10,
          "hourlyLimit": 50,
          "totalRecipients": 3,
          "status": "SCHEDULED",
          "createdAt": "2026-11-03T17:15:48.192Z",
          "senderAccount": {
            "id": "63aee0a6-64b3-46d3-90e3-af72de447b20",
            "email": "sender@reachinbox.com",
            "displayName": "ReachInbox Sender"
          }
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

---

### `GET /api/v1/campaigns/:id`
* **Response (200):**
  ```json
  {
    "success": true,
    "message": "Campaign details retrieved",
    "data": {
      "id": "0a71fe6c-b173-4bd9-8114-c336d32bcef0",
      "subject": "Product Launch Announcement",
      "body": "Hello!",
      "startAt": "2026-11-04T10:00:00.000Z",
      "delaySeconds": 10,
      "hourlyLimit": 50,
      "totalRecipients": 3,
      "status": "PROCESSING",
      "createdAt": "2026-11-03T17:15:48.192Z",
      "updatedAt": "2026-11-03T17:15:54.982Z",
      "senderAccount": {
        "id": "63aee0a6-64b3-46d3-90e3-af72de447b20",
        "email": "sender@reachinbox.com",
        "displayName": "ReachInbox Sender"
      },
      "stats": {
        "total": 3,
        "SCHEDULED": 1,
        "PROCESSING": 0,
        "SENT": 1,
        "FAILED": 1,
        "CANCELLED": 0,
        "RETRY_SCHEDULED": 0,
        "DELIVERY_UNKNOWN": 0
      }
    }
  }
  ```

---

### `POST /api/v1/campaigns/:id/cancel`
* **Response (200):**
  ```json
  {
    "success": true,
    "message": "Campaign cancelled successfully",
    "data": {
      "campaignId": "0a71fe6c-b173-4bd9-8114-c336d32bcef0",
      "cancelledCount": 2,
      "status": "CANCELLED"
    }
  }
  ```

---

## 3.4 Email Records Explorer APIs

### `GET /api/v1/emails/scheduled`
* **Query Parameters:** `page=1&limit=20&search=keyword&campaignId=uuid`
* **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "email-uuid",
          "campaignId": "campaign-uuid",
          "recipientEmail": "sarah@example.com",
          "subject": "Product Launch Announcement",
          "scheduledAt": "2026-11-04T10:00:10.000Z",
          "status": "SCHEDULED",
          "retryCount": 0,
          "sequenceNumber": 2,
          "createdAt": "2026-11-03T17:15:48.192Z"
        }
      ],
      "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
    }
  }
  ```

### `GET /api/v1/emails/sent`
* **Query Parameters:** `page=1&limit=20&search=keyword&startDate=iso&endDate=iso`
* **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "email-uuid",
          "campaignId": "campaign-uuid",
          "recipientEmail": "john@example.com",
          "subject": "Product Launch Announcement",
          "sentAt": "2026-11-04T10:00:02.120Z",
          "status": "SENT",
          "providerMessageId": "<1730654102-ethereal@email.com>",
          "sequenceNumber": 1
        }
      ],
      "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
    }
  }
  ```

### `GET /api/v1/emails/failed`
* **Query Parameters:** `page=1&limit=20&search=keyword`
* **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "email-uuid",
          "campaignId": "campaign-uuid",
          "recipientEmail": "alex@example.com",
          "subject": "Product Launch Announcement",
          "scheduledAt": "2026-11-04T10:00:20.000Z",
          "status": "FAILED",
          "retryCount": 0,
          "errorCode": "SMTP_550",
          "errorMessage": "5.1.1 User mailbox unknown",
          "updatedAt": "2026-11-04T10:00:22.000Z"
        }
      ],
      "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
    }
  }
  ```

### `GET /api/v1/emails/:id`
* **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "email-uuid",
      "recipientEmail": "alex@example.com",
      "subject": "Product Launch Announcement",
      "body": "Hello!",
      "status": "FAILED",
      "errorCode": "SMTP_550",
      "errorMessage": "5.1.1 User mailbox unknown",
      "campaign": {
        "id": "campaign-uuid",
        "subject": "Product Launch Announcement",
        "status": "PARTIALLY_COMPLETED"
      },
      "senderAccount": {
        "email": "sender@reachinbox.com",
        "displayName": "ReachInbox Sender"
      },
      "events": [
        {
          "id": "event-1",
          "eventType": "EMAIL_CREATED",
          "previousStatus": null,
          "newStatus": "SCHEDULED",
          "createdAt": "2026-11-03T17:15:48.000Z"
        },
        {
          "id": "event-2",
          "eventType": "EMAIL_PROCESSING",
          "previousStatus": "SCHEDULED",
          "newStatus": "PROCESSING",
          "createdAt": "2026-11-03T17:15:50.000Z"
        },
        {
          "id": "event-3",
          "eventType": "EMAIL_FAILED",
          "previousStatus": "PROCESSING",
          "newStatus": "FAILED",
          "metadata": {
            "errorCode": "SMTP_550",
            "errorMessage": "5.1.1 User mailbox unknown"
          },
          "createdAt": "2026-11-03T17:15:52.000Z"
        }
      ]
    }
  }
  ```

---

# 4. TypeScript Interfaces & Data Models

Place these in `src/types/api.ts`:

```typescript
export type CampaignStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type EmailStatus =
  | 'CREATED'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'RETRY_SCHEDULED'
  | 'SENT'
  | 'DELIVERY_UNKNOWN'
  | 'FAILED'
  | 'CANCELLED';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatarUrl?: string | null;
}

export interface SenderAccount {
  id: string;
  userId: string;
  email: string;
  displayName?: string | null;
  smtpHost: string;
  smtpPort: number;
  isActive: boolean;
  createdAt: string;
}

export interface CampaignStats {
  total: number;
  SCHEDULED: number;
  PROCESSING: number;
  SENT: number;
  FAILED: number;
  CANCELLED: number;
  RETRY_SCHEDULED: number;
  DELIVERY_UNKNOWN: number;
}

export interface EmailCampaign {
  id: string;
  subject: string;
  body: string;
  startAt: string;
  delaySeconds: number;
  hourlyLimit: number;
  totalRecipients: number;
  status: CampaignStatus;
  createdAt: string;
  updatedAt?: string;
  senderAccount?: {
    id: string;
    email: string;
    displayName?: string | null;
  };
  stats?: CampaignStats;
}

export interface EmailRecord {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  scheduledAt?: string;
  sentAt?: string | null;
  status: EmailStatus;
  retryCount?: number;
  sequenceNumber?: number;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface EmailEvent {
  id: string;
  eventType: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface ScheduleCampaignPayload {
  senderAccountId: string;
  subject: string;
  body: string;
  recipients: string[];
  startAt: string; // ISO 8601
  delaySeconds: number;
  hourlyLimit: number;
}

export interface ScheduleCampaignResponse {
  campaignId: string;
  totalRecipients: number;
  deduplicatedCount: number;
  status: CampaignStatus;
  scheduledCount: number;
}
```

---

# 5. Recommended Frontend Project Structure

```text
frontend/
│
├── src/
│   │
│   ├── api/
│   │   ├── client.ts             # Axios / Fetch client with withCredentials & x-user-id
│   │   ├── auth.api.ts           # getMe, logout
│   │   ├── campaigns.api.ts      # scheduleCampaign, listCampaigns, getCampaign, cancelCampaign
│   │   ├── emails.api.ts         # listScheduled, listSent, listFailed, getEmailById
│   │   └── senders.api.ts        # listSenders, createSender
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Navbar.tsx        # Top navigation with user avatar, status pill & quick action
│   │   │   ├── Sidebar.tsx       # Navigation tabs: Dashboard, Campaigns, Emails, Senders
│   │   │   ├── Badge.tsx         # Status color badges (e.g. Green=SENT, Blue=SCHEDULED, Red=FAILED)
│   │   │   ├── Pagination.tsx   # Pagination controller (page, limit, totalPages)
│   │   │   ├── Modal.tsx         # Generic dialog modal
│   │   │   └── Toast.tsx         # Notification alerts (deduplication notifications, errors)
│   │   │
│   │   ├── campaigns/
│   │   │   ├── CampaignCard.tsx        # Campaign summary with visual delivery progress bar
│   │   │   ├── CampaignList.tsx        # Paginated campaign table/cards
│   │   │   ├── CampaignDetailModal.tsx # Breakdown of campaign recipient delivery status
│   │   │   └── ScheduleModal.tsx       # Main scheduling modal with live preview & validation
│   │   │
│   │   ├── emails/
│   │   │   ├── EmailTable.tsx          # Shared table for scheduled/sent/failed records
│   │   │   ├── EmailDetailDrawer.tsx   # Side drawer showing email body + audit events timeline
│   │   │   └── EmailFilters.tsx        # Search bar and status/date range filters
│   │   │
│   │   └── senders/
│   │       ├── SenderList.tsx          # List of active sender accounts
│   │       └── AddSenderModal.tsx      # Modal to add Ethereal SMTP credentials
│   │
│   ├── context/
│   │   └── AuthContext.tsx       # Provides current user, isAuthenticated, dev user switcher
│   │
│   ├── hooks/
│   │   ├── useCampaigns.ts       # React Query / SWR / custom hook for polling campaigns
│   │   ├── useEmails.ts          # Hook for fetching paginated email lists
│   │   └── useSenders.ts         # Hook for managing senders
│   │
│   ├── pages/
│   │   ├── DashboardPage.tsx     # Overview: total scheduled, sent, failed stats & recent campaigns
│   │   ├── CampaignsPage.tsx     # Full campaigns list with cancel action
│   │   ├── EmailsPage.tsx        # Tabs: Scheduled / Sent / Failed
│   │   └── SendersPage.tsx       # Senders management
│   │
│   ├── types/
│   │   └── api.ts                # TypeScript interfaces (from Section 4)
│   │
│   ├── utils/
│   │   ├── date.util.ts          # Format ISO dates to human-friendly strings
│   │   └── status.util.ts        # Map statuses to colors, icons, and human labels
│   │
│   ├── App.tsx                   # Routes and main layout wrapper
│   ├── main.tsx                  # Vite React entry point
│   └── index.css                 # Tailwind CSS directives
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .env.example
```

---

# 6. Step-by-Step Instructions for the AI Agent

When handing this specification to an AI agent, instruct it to execute these exact steps:

### Step 1: Initialize Vite + Tailwind
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install lucide-react axios clsx tailwind-merge
```

### Step 2: Configure API Client (`src/api/client.ts`)
```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // Fallback development header for non-OAuth testing
    'x-user-id': 'fcbceaa8-84b8-4cdf-8d8e-008906a02d8c',
  },
});
```

### Step 3: Configure Vite Proxy (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
```

### Step 4: Implement Status Visual Mapping
In `src/utils/status.util.ts`:
* `SENT`: **Green** (`bg-green-100 text-green-800 border-green-300`)
* `SCHEDULED`: **Blue** (`bg-blue-100 text-blue-800 border-blue-300`)
* `PROCESSING`: **Amber / Yellow** with pulse animation (`bg-amber-100 text-amber-800 animate-pulse`)
* `RETRY_SCHEDULED`: **Orange** (`bg-orange-100 text-orange-800`)
* `FAILED`: **Red** (`bg-red-100 text-red-800 border-red-300`)
* `CANCELLED`: **Gray** (`bg-gray-100 text-gray-700`)
* `DELIVERY_UNKNOWN`: **Purple** (`bg-purple-100 text-purple-800`)

### Step 5: Implement Key UX Polish Items
1. **Auto-refresh / Polling:** Poll active campaigns and emails every 5 seconds so users see real-time status transitions (`SCHEDULED` → `PROCESSING` → `SENT`).
2. **Deduplication Notification:** When `scheduleCampaign()` returns `deduplicatedCount > 0`, display a dismissible warning pill: *"Notice: {N} duplicate recipient(s) were automatically merged."*
3. **Cancellation Safety:** Show a confirmation dialog before calling `POST /api/v1/campaigns/:id/cancel`.
4. **Error Drawer:** Clicking any `FAILED` row opens a drawer displaying the full SMTP error code and message.
5. **Ethereal Preview Button:** For `SENT` emails, if `providerMessageId` or `metadata.previewUrl` is available, show an *"Open Preview"* link that opens Ethereal in a new tab.

---

# 7. Verification Checklist for the Frontend

Before declaring completion, the frontend agent should verify:
- [ ] Connects to `http://localhost:5001/health` and displays backend online status.
- [ ] Loads active senders from `GET /api/v1/senders`.
- [ ] Schedules a new campaign with delay and hourly limit via `POST /api/v1/emails/schedule`.
- [ ] Verifies the deduplication notification when duplicate emails are entered.
- [ ] Views scheduled emails under the "Scheduled" tab.
- [ ] Watches emails move from "Scheduled" to "Sent" or "Failed" as background workers process them.
- [ ] Cancels a pending campaign and verifies status changes to `CANCELLED`.
- [ ] Inspects email audit timeline modal (`GET /api/v1/emails/:id`).

