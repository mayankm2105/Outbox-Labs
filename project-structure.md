# ReachInbox — Backend Architecture, Technical Specification & Implementation Plan

**Project:** ReachInbox Email Scheduler  
**Document Type:** System Architecture, Backend Design, API Specification & Implementation Plan  
**Architecture:** Modular Monolith + Asynchronous Worker System  
**Backend:** Node.js, Express.js, TypeScript  
**Database:** PostgreSQL  
**Queue:** BullMQ + Redis  
**Email Provider:** Ethereal SMTP  
**Search Engine:** Elasticsearch  
**Authentication:** Google OAuth 2.0  
**Notifications:** Slack OAuth/API  
**Frontend:** React + TypeScript

---

# Part I — System Architecture & Technical Specification

---

# 1. System Overview

## 1.1 Objective

Build a production-oriented email scheduling service that allows authenticated users to:

1. Connect their Google account.
2. Compose an email and provide a list of recipients.
3. Schedule emails for a specific start time.
4. Configure the delay between individual email sends.
5. Configure an hourly sending limit.
6. Schedule emails through a persistent background queue.
7. View scheduled, processing, sent, and failed emails.
8. Search scheduled and sent email records.
9. Receive Slack notifications when an hourly sending limit is reached.
10. Monitor queue activity through a BullMQ dashboard.

The system must continue functioning after backend or worker restarts. Scheduled jobs must not be lost, and duplicate email sending must be prevented as far as the underlying SMTP delivery mechanism allows.

## 1.2 Core Architectural Principles

The implementation must follow these principles:

- **Separation of concerns:** API routes, business logic, database operations, queue operations, and workers must remain separate.
- **Database as source of truth:** PostgreSQL stores the authoritative state of every email.
- **Redis as queue infrastructure:** Redis and BullMQ manage asynchronous execution and delayed jobs.
- **Persistent scheduling:** Scheduled jobs must survive application restarts.
- **Idempotency:** Repeated API requests and job retries must not create duplicate scheduling records or unnecessarily resend emails.
- **Multi-user isolation:** A user must only access their own email campaigns, sender accounts, and integrations.
- **Configurable limits:** Sending limits, worker concurrency, and delays must be configurable without changing source code.
- **Observability:** Every important state transition, retry, failure, and rate-limit event must be logged.
- **API-first development:** The backend must be testable independently before the frontend is connected.

## 1.3 High-Level Architecture

The system will use a modular monolith for the API and separate worker processes for asynchronous execution.

```text
                       FRONTEND
                    React + TypeScript
                           |
                           |
                     REST API Calls
                           |
                           v
                 EXPRESS API SERVER
                           |
         +-----------------+------------------+
         |                 |                  |
         v                 v                  v
    Auth Module       Email Module       Integration Module
         |                 |                  |
         |                 v                  |
         |          Scheduling Service        |
         |                 |                  |
         +-----------------+------------------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
        PostgreSQL                     Redis
     (Source of Truth)             (BullMQ Queues)
                                         |
                                         v
                                  EMAIL WORKERS
                                         |
                              +----------+----------+
                              |                     |
                              v                     v
                         Rate Limiter          SMTP Service
                              |                     |
                              |                     v
                              |                Ethereal SMTP
                              |
                              v
                         Slack Service

             PostgreSQL / Email Events
                           |
                           v
                     Elasticsearch
                           |
                           v
                    Search API / UI

                 Bull Board Dashboard
                    Queue Monitoring
```

**Important:** The Express API must not directly send scheduled emails. It should validate requests, persist records, and enqueue jobs. Actual email delivery belongs to background workers.

---

# 2. Database Schema

## 2.1 Database Design Decisions

Use PostgreSQL as the primary relational database.

The database will contain the following main entities:

1. Users
2. Sender Accounts
3. Email Campaigns
4. Email Recipients
5. Email Jobs / Email Records
6. Email Events
7. Slack Integrations
8. Idempotency Records
9. Outbox Events *(added — required for transactional outbox pattern)*

The design separates campaigns from individual emails.

A campaign represents one scheduling request containing multiple recipients. Each recipient receives an individual email record and an individual BullMQ job.

This makes it possible to track each recipient's delivery status independently.

## 2.2 Entity Relationships

```text
USERS
  |
  | 1:N
  |
  +------------------- SENDER_ACCOUNTS
  |
  | 1:N
  |
  +------------------- EMAIL_CAMPAIGNS
                            |
                            | 1:N
                            |
                            v
                       EMAIL_RECORDS
                            |
                            | 1:N
                            |
                            v
                       EMAIL_EVENTS

USERS
  |
  | 1:N
  |
  +------------------- SLACK_INTEGRATIONS

USERS
  |
  | 1:N
  |
  +------------------- IDEMPOTENCY_KEYS

OUTBOX_EVENTS (standalone — references email_records or campaigns by payload)
```

## 2.3 Table: users

Stores authenticated user information obtained through Google OAuth.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique user identifier |
| google_id | VARCHAR(255) | Unique, Not Null | Google account identifier |
| email | VARCHAR(255) | Unique, Not Null | User email |
| name | VARCHAR(255) | Not Null | User's display name |
| avatar_url | TEXT | Nullable | Google profile image |
| role | VARCHAR(20) | Not Null, Default 'USER' | Authorization role: `USER` or `ADMIN` |
| created_at | TIMESTAMPTZ | Not Null | Account creation time |
| updated_at | TIMESTAMPTZ | Not Null | Last update time |

**Important:** Google access tokens should not be stored unless required for a specific Google API integration. This project only needs Google identity authentication.

**Note on `role`:** Admin users are promoted by directly setting `role = 'ADMIN'` in the database (migration-time seed or manual operation). Document this in the README. No admin promotion UI is built within the assignment scope.

## 2.4 Table: sender_accounts

Represents the sender identities used to send emails through Ethereal SMTP.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Sender identifier |
| user_id | UUID | Foreign Key → users.id | Account owner |
| email | VARCHAR(255) | Not Null | Sender email address |
| display_name | VARCHAR(255) | Nullable | Sender display name |
| smtp_host | VARCHAR(255) | Not Null | SMTP host |
| smtp_port | INTEGER | Not Null | SMTP port |
| smtp_username | TEXT | Not Null | SMTP username |
| smtp_password_encrypted | TEXT | Not Null | AES-256-GCM encrypted SMTP password |
| is_active | BOOLEAN | Default TRUE | Whether sender can be used |
| created_at | TIMESTAMPTZ | Not Null | Creation time |

A sender account should be associated with a user. For the initial implementation, one default Ethereal sender account per user is sufficient. The schema supports multiple senders for future extension.

**Security requirement:** Never expose SMTP credentials through API responses or application logs.

## 2.5 Table: email_campaigns

Stores the high-level scheduling request.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Campaign identifier |
| user_id | UUID | Foreign Key → users.id | Campaign owner |
| sender_account_id | UUID | Foreign Key → sender_accounts.id | Sender identity |
| subject | VARCHAR(998) | Not Null | Email subject |
| body | TEXT | Not Null | Email body |
| start_at | TIMESTAMPTZ | Not Null | Requested campaign start time |
| delay_seconds | INTEGER | Default 0 | Delay between individual emails |
| hourly_limit | INTEGER | Not Null | Campaign's configured hourly limit |
| total_recipients | INTEGER | Not Null | Number of recipients |
| status | VARCHAR(30) | Not Null | Campaign status |
| created_at | TIMESTAMPTZ | Not Null | Creation time |
| updated_at | TIMESTAMPTZ | Not Null | Last update time |

Allowed campaign statuses:

- `SCHEDULED`
- `PROCESSING`
- `COMPLETED`
- `PARTIALLY_COMPLETED`
- `FAILED`
- `CANCELLED`

The campaign status is an aggregate of the individual email records. It must not be used as the sole source of truth for individual delivery status. Campaign status is updated eagerly after each email record status transition to avoid expensive COUNT queries on every GET.

## 2.6 Table: email_records

This is the most important table in the system. Each row represents one email addressed to one recipient.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Unique email record ID |
| campaign_id | UUID | Foreign Key → email_campaigns.id | Parent campaign |
| user_id | UUID | Foreign Key → users.id | Owner |
| sender_account_id | UUID | Foreign Key → sender_accounts.id | Sending account |
| recipient_email | VARCHAR(255) | Not Null | Recipient address |
| subject | VARCHAR(998) | Not Null | Email subject |
| body | TEXT | Not Null | Email body |
| sequence_number | INTEGER | Not Null | Position in campaign (1-indexed) |
| scheduled_at | TIMESTAMPTZ | Not Null | Actual planned delivery time |
| sent_at | TIMESTAMPTZ | Nullable | Actual send time |
| status | VARCHAR(30) | Not Null | Current lifecycle status |
| retry_count | INTEGER | Default 0 | Number of retry attempts |
| max_retries | INTEGER | Default 5 | Maximum retry attempts |
| next_retry_at | TIMESTAMPTZ | Nullable | Next retry time |
| provider_message_id | TEXT | Nullable | SMTP/provider message ID |
| error_code | VARCHAR(100) | Nullable | Last error code |
| error_message | TEXT | Nullable | Last error description |
| created_at | TIMESTAMPTZ | Not Null | Creation time |
| updated_at | TIMESTAMPTZ | Not Null | Last update time |

Constraints and indexes:

- Unique constraint on `(campaign_id, sequence_number)`.
- Index on `(user_id, status)`.
- Index on `(campaign_id, status)`.
- Index on `(scheduled_at, status)`.
- Index on `(user_id, created_at)`.
- Index on `(recipient_email)` where useful for search.
- All ownership checks must use `user_id`.

`scheduled_at` must represent the effective planned send time, not necessarily the originally requested campaign start time. Rate limiting may move it into a later time window.

**Note on `sequence_number`:** 1-indexed for human readability in API responses.

## 2.7 Table: email_events

Maintains an audit trail of email lifecycle transitions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Event identifier |
| email_record_id | UUID | Foreign Key → email_records.id | Associated email |
| event_type | VARCHAR(50) | Not Null | Event name |
| previous_status | VARCHAR(30) | Nullable | Previous status |
| new_status | VARCHAR(30) | Nullable | New status |
| metadata | JSONB | Nullable | Additional event details |
| created_at | TIMESTAMPTZ | Not Null | Event time |

Example events:

- `EMAIL_CREATED`
- `EMAIL_QUEUED`
- `EMAIL_PROCESSING`
- `EMAIL_RATE_LIMITED`
- `EMAIL_RESCHEDULED`
- `EMAIL_SEND_STARTED`
- `EMAIL_SENT`
- `EMAIL_RETRY_SCHEDULED`
- `EMAIL_FAILED`
- `EMAIL_CANCELLED`

## 2.8 Table: slack_integrations

Stores Slack connection information for each user.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Integration ID |
| user_id | UUID | Foreign Key → users.id | Account owner |
| team_id | VARCHAR(255) | Nullable | Slack workspace ID |
| team_name | VARCHAR(255) | Nullable | Workspace name |
| access_token_encrypted | TEXT | Nullable | AES-256-GCM encrypted OAuth token |
| channel_id | VARCHAR(255) | Nullable | Notification channel |
| is_connected | BOOLEAN | Default FALSE | Connection state |
| connected_at | TIMESTAMPTZ | Nullable | Connection time |
| updated_at | TIMESTAMPTZ | Not Null | Last update |

Use encrypted token storage. Do not expose tokens in API responses.

## 2.9 Table: idempotency_keys

Prevents duplicate campaign creation when clients retry requests.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Record ID |
| user_id | UUID | Foreign Key → users.id | Request owner |
| idempotency_key | VARCHAR(255) | Not Null | Client-generated key |
| request_hash | VARCHAR(64) | Not Null | Hash of request payload |
| response_status | INTEGER | Nullable | Original HTTP status |
| response_body | JSONB | Nullable | Original response |
| created_at | TIMESTAMPTZ | Not Null | Creation time |
| expires_at | TIMESTAMPTZ | Not Null | Expiry time |

Unique constraint: `(user_id, idempotency_key)`.

If the same key is reused with a different request payload, return `409 Conflict`.

## 2.10 Table: outbox_events

Required for the transactional outbox pattern. Ensures database and queue operations remain consistent.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | Primary Key | Event ID |
| type | VARCHAR(50) | Not Null | Event type: `EMAIL_SCHEDULE`, `ES_INDEX` |
| payload | JSONB | Not Null | Event-specific data |
| published_at | TIMESTAMPTZ | Nullable | Timestamp when published to queue |
| created_at | TIMESTAMPTZ | Not Null | Creation time |

- `published_at = NULL` means the event has not yet been picked up by the outbox publisher.
- The outbox publisher polls for records where `published_at IS NULL`.
- After successfully adding the corresponding BullMQ job, the publisher sets `published_at` to the current timestamp.

## 2.11 Additional Database Design Requirements

- Use UUIDs for all primary keys.
- Use UTC timestamps (`TIMESTAMPTZ`) in the database.
- Use database transactions when creating campaigns and their recipient records.
- Add foreign keys and appropriate indexes.
- Use parameterized queries or an ORM.
- Do not delete email records immediately after sending.
- Keep lifecycle events for auditability.
- Consider pagination for all list endpoints.
- Ensure all user-owned queries filter by authenticated `user_id`.

**ORM:** Prisma 5 with PostgreSQL.

---

# 3. API Contracts

## 3.1 API Standards

Base URL: `/api/v1`

All endpoints must return JSON.

Authentication should be handled through a secure session cookie.

Standard success response:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

Standard error response:

```json
{
  "success": false,
  "message": "Invalid request",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": []
  }
}
```

All API timestamps must use ISO 8601 format in UTC.

All authenticated endpoints must identify the user through the server-side session. Never trust a `user_id` supplied in the request body.

## 3.2 Authentication APIs

### GET /api/v1/auth/google

Initiates Google OAuth authentication.

**Purpose:** Redirect the user to Google's authorization page.

---

### GET /api/v1/auth/google/callback

Handles Google's OAuth callback.

**Backend responsibilities:**

1. Validate OAuth state.
2. Exchange authorization code.
3. Retrieve the Google profile.
4. Find or create the user.
5. Create an authenticated session.
6. Redirect to the frontend dashboard.

Must reject invalid, expired, or mismatched OAuth state values.

---

### GET /api/v1/auth/me

Returns the currently authenticated user.

Example response:

```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@gmail.com",
    "avatarUrl": "https://example.com/avatar.png"
  }
}
```

---

### POST /api/v1/auth/logout

Destroys the active session and clears the session cookie.

---

## 3.3 Email Scheduling APIs

### POST /api/v1/emails/schedule

Creates a new campaign and schedules its individual emails.

**Headers:**

```
Idempotency-Key: <unique-client-generated-key>
```

**Request body:**

```json
{
  "senderAccountId": "sender-uuid",
  "subject": "Product Update",
  "body": "Hello, this is our product update.",
  "recipients": [
    "person1@example.com",
    "person2@example.com",
    "person3@example.com"
  ],
  "startAt": "2026-11-05T10:00:00.000Z",
  "delaySeconds": 60,
  "hourlyLimit": 100
}
```

---

#### Request Validation

**General rules:**

- Subject must not be empty.
- Body must not be empty.
- Recipients must be valid email addresses.
- `delaySeconds` must be non-negative and within configured bounds.
- `hourlyLimit` must be a positive integer within the allowed system maximum.
- Sender account must belong to the authenticated user.
- Recipient count must be within the configured system maximum (`MAX_RECIPIENTS_PER_CAMPAIGN`, default 500).

**Duplicate recipient policy:**

Duplicate recipient addresses within the same request are silently deduplicated (first occurrence is kept). The response includes a `deduplicatedCount` field indicating how many duplicate entries were removed. Cross-campaign duplicates are allowed — the same address can appear in different campaigns.

---

#### `startAt` Validation and Grace Window

- `startAt` must be a valid ISO 8601 timestamp.
- The backend must allow a **60-second grace window** for timestamps slightly in the past to account for network latency and request-processing delays.
- Validation rule:
  - Accept if `startAt >= currentServerTime - 60 seconds`.
  - Reject if `startAt < currentServerTime - 60 seconds`.
- If `startAt` is in the past but falls within the grace window, treat the campaign as an **immediate-scheduling request** by setting its effective start time to the current server time.
- If `startAt` is in the future, preserve the requested timestamp and schedule the campaign accordingly.
- All timestamp comparisons must use UTC and the backend server's clock, not the client's local clock.

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "error": {
    "code": "START_TIME_IN_PAST",
    "message": "Start time must be in the future or within the allowed 60-second grace window."
  }
}
```

**Example:**

If the server time is `11:00:00`:

| `startAt` | Result |
|---|---|
| `10:59:30` | Accepted; treated as immediate (effective startAt = server time) |
| `11:00:00` | Accepted; treated as immediate |
| `11:05:00` | Accepted; scheduled for 11:05 |
| `10:58:30` | Rejected — `START_TIME_IN_PAST` |

---

#### Processing

1. Authenticate user.
2. Validate request (including `startAt` grace window check).
3. Validate sender ownership.
4. Check idempotency key.
5. Deduplicate recipients silently; record `deduplicatedCount`.
6. Create campaign with effective start time.
7. Create one email record per unique recipient.
8. Calculate initial scheduled times using delay rules.
9. Persist all records in a database transaction (campaign + email records + outbox events).
10. Outbox publisher reads events and enqueues BullMQ jobs asynchronously.
11. Return campaign details.

**Important:** Do not send emails inside this API request. Return `202 Accepted` because scheduling is asynchronous.

**Example response:**

```json
{
  "success": true,
  "message": "Campaign scheduled successfully",
  "data": {
    "campaignId": "campaign-uuid",
    "totalRecipients": 3,
    "deduplicatedCount": 1,
    "status": "SCHEDULED",
    "scheduledCount": 3
  }
}
```

---

### GET /api/v1/emails/scheduled

Returns scheduled and pending emails belonging to the authenticated user.

**Query parameters:** `page`, `limit`, `search`, `campaignId`, `status`, `sortBy`, `sortOrder`

**Example:** `GET /api/v1/emails/scheduled?page=1&limit=20`

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "email-uuid",
        "recipientEmail": "person@example.com",
        "subject": "Product Update",
        "scheduledAt": "2026-11-05T10:00:00.000Z",
        "status": "SCHEDULED"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### GET /api/v1/emails/sent

Returns sent email records.

**Query parameters:** `page`, `limit`, `search`, `startDate`, `endDate`, `campaignId`

Each item includes recipient, subject, sent time, and status.

---

### GET /api/v1/emails/failed

Returns failed emails with error information.

---

### GET /api/v1/emails/:id

Returns detailed information about one email. Must verify ownership before returning the record. Returns `404 Not Found` for records the user does not own.

---

### GET /api/v1/campaigns

Returns campaigns created by the authenticated user.

---

### GET /api/v1/campaigns/:id

Returns campaign details and aggregate statistics.

---

### GET /api/v1/campaigns/:id/emails

Returns paginated individual email records for a campaign.

---

### POST /api/v1/campaigns/:id/cancel

Cancels pending emails belonging to a campaign.

**Rules:**

- Only `SCHEDULED` and `RETRY_SCHEDULED` emails can be cancelled.
- `PROCESSING` or already `SENT` emails cannot be reliably cancelled.
- Attempt to remove or invalidate pending BullMQ delayed jobs; log but do not fail if removal is rejected (e.g., job is `active`).
- The worker performs a database status check as its first action — if status is `CANCELLED`, it exits cleanly. This is the authoritative safety net.
- Update database status to `CANCELLED`.
- Record `EMAIL_CANCELLED` events.

---

## 3.4 Sender Account APIs

### GET /api/v1/senders

Returns the user's sender accounts. SMTP credentials must never be returned.

### POST /api/v1/senders

Creates or configures an Ethereal sender account.

### PATCH /api/v1/senders/:id

Updates permitted sender details.

### DELETE /api/v1/senders/:id

Disables or removes a sender account if it is not actively required by pending campaigns.

---

## 3.5 Slack Integration APIs

### GET /api/v1/integrations/slack/connect

Initiates Slack OAuth.

### GET /api/v1/integrations/slack/callback

Handles Slack OAuth callback and stores encrypted credentials.

### GET /api/v1/integrations/slack/status

Returns whether Slack is connected.

```json
{
  "success": true,
  "data": {
    "connected": true,
    "workspaceName": "My Workspace"
  }
}
```

### DELETE /api/v1/integrations/slack

Disconnects Slack and invalidates stored credentials.

### POST /api/v1/integrations/slack/test

Sends a hardcoded test notification to verify the integration. Does not require a rate-limit event to have occurred.

---

## 3.6 Queue Monitoring APIs

### GET /api/v1/admin/queue/stats

Returns queue statistics. Restricted to users with `role = 'ADMIN'`.

```json
{
  "success": true,
  "data": {
    "waiting": 10,
    "delayed": 120,
    "active": 3,
    "completed": 500,
    "failed": 4
  }
}
```

Bull Board is mounted at `/admin/queues` behind `requireAdmin` middleware and must not be publicly accessible.

---

## 3.7 API Contract Rules

- Use correct HTTP status codes.
- Validate all inputs using Zod.
- Return consistent error structures.
- Enforce authentication and ownership checks.
- Use pagination for list endpoints.
- Never expose database stack traces, credentials, access tokens, or internal Redis information.
- Maintain API versioning through `/api/v1`.
- Document contracts using OpenAPI/Swagger (auto-generated from Zod schemas via `zod-to-openapi`).

---

# 4. BullMQ Job Structure

## 4.1 Queue Design

Use BullMQ with Redis for persistent asynchronous processing.

| Queue | Responsibility |
|---|---|
| `email-scheduling` | Schedules email delivery jobs |
| `email-sending` | Executes email delivery |
| `notification` | Sends Slack notifications |
| `email-reconciliation` | Repairs inconsistencies between database and queue |

## 4.2 Email Job Payload

Each email job contains only identifiers and minimal execution metadata.

```json
{
  "emailRecordId": "email-uuid",
  "campaignId": "campaign-uuid",
  "userId": "user-uuid",
  "senderAccountId": "sender-uuid",
  "scheduledAt": "2026-11-05T10:00:00.000Z"
}
```

Do not put SMTP passwords, Slack tokens, or other secrets inside BullMQ job data. The worker fetches the latest email details from PostgreSQL before sending.

## 4.3 Job Identification

Use a **generation-based deterministic job ID:**

```
email-{emailRecordId}-gen-{retryCount}
```

`retryCount` is taken from the `email_records` table and is incremented on each reschedule. This gives a fresh, predictable ID for each rescheduled attempt while remaining deterministic and preventing duplicate job creation for the same generation.

The database remains authoritative. A deterministic BullMQ job ID alone is not sufficient for end-to-end idempotency.

## 4.4 Job Options

```typescript
{
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 5000
  },
  removeOnComplete: {
    age: 86400,
    count: 10000
  },
  removeOnFail: false
}
```

All values are configurable via environment variables. Keep failed jobs for inspection.

## 4.5 Scheduling Strategy

For a campaign with start time 10:00 AM, 60-second delay, and 3 recipients:

| Recipient | Sequence | Scheduled Time |
|---|---|---|
| Recipient 1 | 1 | 10:00 AM |
| Recipient 2 | 2 | 10:01 AM |
| Recipient 3 | 3 | 10:02 AM |

BullMQ delayed jobs are used for all future scheduling. OS cron and Node cron libraries must not be used.

## 4.6 Database and Queue Consistency — Transactional Outbox

PostgreSQL and Redis cannot participate in one ordinary atomic transaction.

Within one PostgreSQL transaction:
1. Create the campaign.
2. Create email records.
3. Create corresponding outbox events (`type = 'EMAIL_SCHEDULE'`).

The **outbox publisher** (a separate worker process) polls for unpublished outbox events (`published_at IS NULL`) and adds jobs to BullMQ. After successfully adding a job, it sets `published_at`. A Redis distributed lock (`SET NX EX`) ensures only one publisher runs at a time across restarts.

A **reconciliation worker** detects email records in `SCHEDULED` state with no corresponding active or completed BullMQ job and recreates those jobs.

---

# 5. Worker Architecture

## 5.1 Worker Types

1. **Email Scheduling Worker** — reads scheduling outbox events, creates BullMQ delayed jobs.
2. **Email Sending Worker** — executes actual email delivery via SMTP.
3. **Notification Worker** — sends Slack notifications.
4. **Outbox Publisher** — polls and publishes unprocessed outbox events.
5. **Reconciliation Worker** — detects and repairs missing BullMQ jobs.

API server and worker processes must be independently deployable. They share the same codebase with different entry points.

## 5.2 Email Sending Worker — Processing Sequence

```text
BullMQ Job Received
        |
        v
Fetch Email Record from PostgreSQL
        |
        v
Check Current Database Status
        |
        v
Is Email Cancelled / Already Sent?
        |
       Yes ------------------> Exit Safely
        |
       No
        |
        v
Check Sender Account Status
        |
        v
Check Hourly Rate Limit
        |
       / \
      /   \
  Allowed  Limit Reached
    |           |
    v           v
Send Email   Reschedule Job
    |           |
    v           v
Update DB   Notify Slack Once
    |
    v
Record Email Event
    |
    v
Complete Job
```

**Critical delivery caveat:** SMTP delivery and a PostgreSQL transaction cannot be made atomic. If SMTP accepts an email and the worker crashes before updating PostgreSQL, a retry may send the same email again. The system minimizes this risk, documents it, and never claims guaranteed exactly-once delivery over ordinary SMTP.

## 5.3 Email Provider Interface

```typescript
interface EmailProvider {
  sendEmail(input: {
    from: string;
    to: string;
    subject: string;
    body: string;
  }): Promise<{
    messageId: string;
  }>;
}
```

Implement `EtherealEmailProvider` using Nodemailer. The worker must not directly contain SMTP transport configuration or provider-specific details. This separation allows a real SMTP provider to replace Ethereal later.

## 5.4 Notification Worker

- Fetches the user's Slack integration from PostgreSQL.
- Verifies the integration is active.
- Sends notifications using the Slack API.
- Never interrupts email processing if Slack is unavailable.
- Uses a Redis deduplication key to send one notification per rate-limit window:
  ```
  rate-limit-notified:{scope}:{scopeId}:{windowId}
  ```

## 5.5 Worker Concurrency

```env
EMAIL_WORKER_CONCURRENCY=5
NOTIFICATION_WORKER_CONCURRENCY=2
```

Concurrency controls simultaneous job processing. Rate limiting must be implemented separately using Redis — concurrency does not enforce the sending rate.

## 5.6 Worker Shutdown

1. Stop accepting new jobs.
2. Allow active jobs to finish within a configured grace period.
3. Close BullMQ workers.
4. Close Redis connections.
5. Exit cleanly.

---

# 6. Email Lifecycle and Statuses

## 6.1 Email Lifecycle

```text
CREATED
   |
   v
SCHEDULED
   |
   v
PROCESSING
   |
   +------------------+------------------+
   |                  |                  |
   v                  v                  v
 SENT          RETRY_SCHEDULED    DELIVERY_UNKNOWN
                      |                  |
                      v          (manual resolution)
                  SCHEDULED        SENT | FAILED
                      |
                      v
                  PROCESSING
                      |
                +-----+-----+
                |           |
                v           v
              SENT        FAILED

SCHEDULED / RETRY_SCHEDULED
    |
    v
CANCELLED
```

A rate-limit event does not mean the email has failed. It means the email must be rescheduled.

## 6.2 Email Status Definitions

| Status | Meaning |
|---|---|
| `CREATED` | Database record created but not yet queued |
| `SCHEDULED` | Email is waiting for its delivery time |
| `PROCESSING` | Worker has claimed the email for sending |
| `RETRY_SCHEDULED` | Temporary failure; retry is planned |
| `SENT` | SMTP provider accepted the message |
| `DELIVERY_UNKNOWN` | SMTP may have accepted the message but the DB update failed; requires investigation |
| `FAILED` | Permanent failure or retry limit exhausted |
| `CANCELLED` | Email was cancelled before sending |

Do not use `DELIVERED` — SMTP acceptance is not proof of recipient delivery.

## 6.3 Allowed State Transitions

| Current Status | Allowed Next Status |
|---|---|
| `CREATED` | `SCHEDULED`, `FAILED` |
| `SCHEDULED` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `SENT`, `RETRY_SCHEDULED`, `FAILED`, `DELIVERY_UNKNOWN` |
| `RETRY_SCHEDULED` | `SCHEDULED`, `PROCESSING`, `FAILED`, `CANCELLED` |
| `DELIVERY_UNKNOWN` | `SENT`, `FAILED` (manual resolution only) |
| `SENT` | No further transition |
| `FAILED` | No automatic transition |
| `CANCELLED` | No further transition |

## 6.4 Campaign Status Calculation

Campaign status is updated eagerly after each email record status transition.

| Condition | Campaign Status |
|---|---|
| All emails pending / scheduled | `SCHEDULED` |
| At least one email processing | `PROCESSING` |
| All emails sent | `COMPLETED` |
| Mix of sent and failed, no pending work | `PARTIALLY_COMPLETED` |
| All emails failed | `FAILED` |
| All cancellable emails cancelled | `CANCELLED` |
| Some sent, rest cancelled | `PARTIALLY_COMPLETED` |
| Any `DELIVERY_UNKNOWN` emails exist | `PROCESSING` (pending resolution) |

---

# 7. Rate-Limiting Strategy

## 7.1 Objective

Enforce a configurable hourly email sending limit. When the limit is reached, reschedule affected jobs — do not permanently fail them. Send a Slack notification when the limit is first reached in a window. Enforce the limit across multiple worker instances.

## 7.2 Two Independent Constraints

**A. Inter-email delay**

Minimum interval between individual emails within a campaign.

Example: 60-second delay → consecutive emails scheduled ≥ 60 seconds apart.

**B. Hourly rate limit**

Maximum emails sent during an hourly window.

Both constraints must be enforced independently.

## 7.3 Effective Rate Limit

```
effectiveLimit = min(GLOBAL_HOURLY_LIMIT, campaign.hourlyLimit)
```

- Sender-level limits are stored in the schema for future use but not enforced in phase 1.
- Redis key scope: `USER:{userId}` — correctly isolates one user's sending rate.
- Defaults are explicitly defined via environment variables.

## 7.4 Redis Sliding-Window Implementation

Use Redis sorted sets:

```
rate-limit:USER:{userId}:emails
```

- Member: unique email record ID.
- Score: reservation timestamp in milliseconds.

An atomic Lua script:
1. Removes expired reservations outside the rolling one-hour window.
2. Counts active reservations.
3. Compares count against the effective limit.
4. If capacity exists, reserves a slot atomically.
5. Otherwise, calculates the earliest reservation expiry.
6. Returns the next eligible send time.

## 7.5 Rescheduling Logic

When the rate limit is reached, the worker:

1. Detects that the limit is reached.
2. Calculates the next eligible send time from the earliest reservation expiry.
3. Updates `scheduled_at` in PostgreSQL.
4. Increments `retry_count` to generate a new job generation.
5. Updates email status to `SCHEDULED`.
6. Records an `EMAIL_RATE_LIMITED` event.
7. Enqueues a new delayed job with the generation-based ID.
8. Completes the current BullMQ job without sending the email.

## 7.6 Scheduling Time Calculation

```
scheduledAt = max(previousScheduledAt + delaySeconds, effectiveStartAt)
```

Then apply the hourly rate-limit constraint. Document ordering policy and test under load.

## 7.7 Redis Failure

If Redis is unavailable — **fail closed:**

- Do not bypass rate limiting.
- Do not send emails without enforcing the configured limit.
- Allow BullMQ's own Redis failure behavior to pause or retry processing.
- Log the infrastructure error.
- Resume when Redis recovers.

---

# 8. Authentication and Authorization

## 8.1 Authentication Mechanism

- Passport.js with Google OAuth 2.0 strategy.
- Express session management.
- `connect-pg-simple` PostgreSQL-backed session store (reuses the existing PG connection pool).
- Secure HTTP-only cookies.

## 8.2 Session Configuration

```typescript
{
  httpOnly: true,
  secure: true,      // false only in local HTTP development via env config
  sameSite: "lax"
}
```

Additional requirements:
- Strong session secrets via environment variable.
- Regenerate session IDs after authentication.
- Configure session expiry (`SESSION_TTL_SECONDS`).
- Destroy sessions on logout.
- CORS restricted to the frontend origin.
- Never store session IDs in local storage.

## 8.3 Authorization Model

**Roles:** `USER` (default), `ADMIN`.

Normal users can:
- View their own profile, campaigns, and emails.
- Create campaigns.
- Cancel their own pending emails.
- Manage their sender accounts.
- Connect or disconnect their Slack integration.

Administrators can:
- View queue statistics.
- Access Bull Board at `/admin/queues`.
- Inspect operational failures.

Admin users are promoted by directly setting `role = 'ADMIN'` in the database. Document this in the README.

## 8.4 Resource Ownership

Every resource query must be scoped to the authenticated user:

```typescript
const email = await prisma.emailRecord.findFirst({
  where: {
    id: emailId,
    userId: authenticatedUser.id
  }
});
```

Never fetch a resource solely by UUID. Return `404 Not Found` (not `403`) for resources the user does not own, to avoid disclosing their existence.

## 8.5 Slack OAuth Security

- Validate OAuth state.
- Request only necessary Slack permissions.
- Encrypt access tokens with AES-256-GCM before storing.
- Never expose tokens to the frontend.
- Handle revoked tokens.
- Support reconnecting after disconnection.

---

# 9. Error Handling and Retry Strategy

## 9.1 Error Categories

| Category | Examples | Handling |
|---|---|---|
| Validation | Invalid email, missing subject | Reject request |
| Authentication | Expired session, invalid OAuth state | Return 401/403 |
| Business Logic | Campaign cancelled, rate limit reached | Apply business rule |
| Infrastructure | Redis unavailable, SMTP timeout, DB failure | Retry or recover |

## 9.2 API Error Handling

Centralized Express error-handling middleware. Never return stack traces, credentials, or internal connection information.

## 9.3 Retry Classification

**Transient errors — retry:**
- Temporary SMTP connection/timeout failures where non-acceptance is confirmed.
- Temporary Redis/database connection errors.
- Provider temporary unavailability.

**Permanent errors — do not retry:**
- Invalid recipient syntax.
- Invalid sender configuration.
- Explicit permanent SMTP rejection.

**Ambiguous SMTP outcomes:** Record as `DELIVERY_UNKNOWN`. Apply a documented recovery policy. Do not blindly retry.

## 9.4 Exponential Backoff

| Attempt | Approximate Delay |
|---|---|
| 1 | 5 seconds |
| 2 | 10 seconds |
| 3 | 20 seconds |
| 4 | 40 seconds |
| 5 | 80 seconds |

Add jitter to prevent thundering herd. All values configurable via env vars.

**Important:** Rate-limit rescheduling is a separate business operation and must not consume the SMTP retry count.

## 9.5 DELIVERY_UNKNOWN Handling

If SMTP accepts an email but PostgreSQL becomes unavailable before the `SENT` update:
- Set status to `DELIVERY_UNKNOWN`.
- Do not blindly resend.
- Reconciliation worker flags stuck `DELIVERY_UNKNOWN` records after a configurable TTL.
- Manual resolution transitions to `SENT` or `FAILED`.

---

# 10. Elasticsearch Search Architecture

## 10.1 Objective

Support fast searching and filtering of email records. PostgreSQL remains the source of truth. Elasticsearch is a derived search index.

## 10.2 Indexed Fields

| Field | Mapping |
|---|---|
| `emailRecordId` | keyword |
| `campaignId` | keyword |
| `userId` | keyword |
| `recipientEmail` | keyword |
| `subject` | text + keyword |
| `status` | keyword |
| `scheduledAt` | date |
| `sentAt` | date |
| `createdAt` | date |

## 10.3 Indexing Flow

Every status transition triggers an `ES_INDEX` outbox event in the same PostgreSQL transaction. A dedicated indexing worker reads these events and upserts the corresponding Elasticsearch document using `emailRecordId` as the document ID (idempotent updates).

If Elasticsearch is temporarily unavailable, retry indexing independently. Email sending must not fail because search indexing is unavailable. The search API always filters by the authenticated `userId`.

---

# 11. Configuration and Environment Variables

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:5000

DATABASE_URL=postgresql://user:password@localhost:5432/reachinbox

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

SESSION_SECRET=
SESSION_TTL_SECONDS=86400

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=
ETHEREAL_PASSWORD=

ELASTICSEARCH_URL=http://localhost:9200

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5000/api/v1/integrations/slack/callback

EMAIL_WORKER_CONCURRENCY=5
NOTIFICATION_WORKER_CONCURRENCY=2

EMAIL_MAX_RETRIES=5
EMAIL_RETRY_BASE_DELAY_MS=5000

GLOBAL_HOURLY_LIMIT=100
DEFAULT_EMAIL_DELAY_SECONDS=60

MAX_RECIPIENTS_PER_CAMPAIGN=500

OUTBOX_POLL_INTERVAL_MS=2000
RECONCILIATION_POLL_INTERVAL_MS=60000

ENCRYPTION_KEY=<32-byte-hex-string>

LOG_LEVEL=info
```

All secrets must be supplied through environment variables or a secure secret manager. Never commit `.env` files to version control.

---

# 12. Backend Folder Structure

```text
backend/
│
├── src/
│   │
│   ├── config/
│   │   ├── env.ts                     # Zod-validated env vars; throws on startup if invalid
│   │   ├── database.ts                # Prisma client singleton
│   │   ├── redis.ts                   # IORedis client singleton with reconnect logic
│   │   ├── session.ts                 # express-session configuration
│   │   └── elasticsearch.ts           # Elasticsearch client
│   │
│   ├── modules/
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts        # find-or-create user logic
│   │   │   ├── auth.middleware.ts     # requireAuth
│   │   │   └── auth.validation.ts
│   │   │
│   │   ├── users/
│   │   │   ├── user.repository.ts
│   │   │   └── user.types.ts
│   │   │
│   │   ├── senders/
│   │   │   ├── sender.routes.ts
│   │   │   ├── sender.controller.ts
│   │   │   ├── sender.service.ts
│   │   │   ├── sender.repository.ts
│   │   │   └── sender.validation.ts
│   │   │
│   │   ├── campaigns/
│   │   │   ├── campaign.routes.ts
│   │   │   ├── campaign.controller.ts
│   │   │   ├── campaign.service.ts
│   │   │   ├── campaign.repository.ts
│   │   │   └── campaign.validation.ts
│   │   │
│   │   ├── emails/
│   │   │   ├── email.routes.ts
│   │   │   ├── email.controller.ts
│   │   │   ├── email.service.ts
│   │   │   ├── email.repository.ts
│   │   │   ├── email.validation.ts
│   │   │   └── email-status.ts        # Status enum + transition validation
│   │   │
│   │   ├── scheduler/
│   │   │   ├── scheduler.service.ts   # Calculates scheduledAt per recipient; writes outbox events
│   │   │   ├── scheduler.queue.ts
│   │   │   └── scheduler.types.ts
│   │   │
│   │   ├── rate-limiter/
│   │   │   ├── rate-limiter.service.ts
│   │   │   ├── rate-limiter.lua.ts    # Atomic Lua sliding-window script
│   │   │   └── rate-limiter.types.ts
│   │   │
│   │   ├── integrations/
│   │   │   └── slack/
│   │   │       ├── slack.routes.ts
│   │   │       ├── slack.controller.ts
│   │   │       └── slack.service.ts
│   │   │
│   │   └── search/
│   │       ├── search.service.ts
│   │       └── search.repository.ts
│   │
│   ├── queues/
│   │   ├── queue.constants.ts         # Queue names
│   │   ├── queue.connection.ts        # IORedis connection for BullMQ
│   │   └── queue.registry.ts          # Queue and QueueEvents instances
│   │
│   ├── workers/
│   │   ├── email-sending.worker.ts    # Actual SMTP delivery
│   │   ├── email-scheduling.worker.ts # ES indexing worker
│   │   ├── notification.worker.ts     # Slack notifications
│   │   ├── outbox.worker.ts           # Polls outbox_events; publishes to BullMQ
│   │   └── reconciliation.worker.ts   # Detects + repairs missing BullMQ jobs
│   │
│   ├── providers/
│   │   └── email/
│   │       ├── email-provider.interface.ts
│   │       └── ethereal.provider.ts   # Nodemailer + Ethereal; logs preview URL
│   │
│   ├── middleware/
│   │   ├── error.middleware.ts        # Centralized error handler
│   │   ├── auth.middleware.ts         # requireAuth, requireAdmin
│   │   ├── validation.middleware.ts   # Zod schema validation wrapper
│   │   ├── idempotency.middleware.ts  # Idempotency-Key header handling
│   │   └── request-logger.middleware.ts
│   │
│   ├── shared/
│   │   ├── errors/
│   │   │   └── api-error.ts           # ApiError class with statusCode + code
│   │   ├── types/
│   │   │   └── express.d.ts           # req.user type augmentation
│   │   ├── utils/
│   │   │   ├── crypto.util.ts         # AES-256-GCM encrypt/decrypt
│   │   │   ├── smtp-error-classifier.ts  # Transient vs. permanent SMTP error
│   │   │   └── pagination.util.ts     # Shared pagination helper
│   │   └── constants/
│   │       └── status.constants.ts
│   │
│   ├── app.ts                         # Express app factory (middleware stack + routes)
│   ├── server.ts                      # HTTP listener entry point
│   └── worker.ts                      # Worker process entry point
│
├── prisma/
│   └── schema.prisma
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

---

# 13. Testing Strategy

## 13.1 Unit Tests (Vitest)

- Email validation
- Campaign scheduling time calculations
- `startAt` grace window validation
- Status transition validation
- Rate-limit Lua script logic (via mock)
- Campaign status aggregation
- Idempotency behavior
- Retry error classification

## 13.2 Integration Tests (Vitest + Supertest)

- API → PostgreSQL (campaign creation, pagination)
- API → Redis/BullMQ (job creation after campaign creation)
- Ownership checks (cross-user access returns 404)
- Outbox publisher → BullMQ flow
- Worker → SMTP provider
- Worker → rate limiter (concurrent access)
- Slack notification worker
- Elasticsearch indexing

## 13.3 End-to-End Tests

1. User logs in with Google.
2. User creates a campaign.
3. Campaign records are stored in PostgreSQL.
4. Jobs are added to BullMQ.
5. Worker processes emails.
6. Email records transition to `SENT`.
7. Sent emails appear in the dashboard API.
8. Failed emails appear in the failed emails API.
9. Restarting the API and worker does not lose pending schedules.
10. Hourly limit reschedules excess emails.
11. Slack notification is generated when the limit is reached.

## 13.4 Required Failure Scenarios

- API crashes after database commit but before outbox publication.
- Redis becomes unavailable.
- Worker crashes during processing.
- SMTP connection times out (ambiguous outcome → `DELIVERY_UNKNOWN`).
- SMTP permanently rejects a recipient.
- Slack is disconnected.
- Same scheduling API request submitted twice with same idempotency key.
- Two workers race on the last available rate-limit slot.
- Campaign is cancelled while emails are queued.
- Email job fires after its database record is already `CANCELLED`.
- `startAt` is exactly 59 seconds in the past → accepted.
- `startAt` is exactly 61 seconds in the past → rejected.

---

# 14. Performance and Scalability

- Use Prisma `createMany` for bulk email record insertion.
- Use BullMQ bulk job insertion where appropriate.
- Use configurable worker concurrency.
- Use Redis atomic operations for rate limiting.
- Avoid loading entire campaigns into memory.
- Use database pagination for all list queries.
- Index frequently queried columns.
- Keep Slack and Elasticsearch operations outside the SMTP critical path.
- Use structured logs (Pino) and operational metrics.
- Handle stalled jobs and graceful worker shutdown.

---

# 15. Development and Deployment Architecture

## 15.1 Docker Compose Services

```yaml
services:
  postgres: ...
  redis: ...
  elasticsearch: ...
  backend-api: ...       # entry: src/server.ts
  backend-worker: ...    # entry: src/worker.ts
```

## 15.2 NPM Scripts

```bash
npm run dev              # Start API server in development
npm run dev:worker       # Start worker processes in development
npm run build            # Compile TypeScript
npm run start            # Start compiled API server
npm run start:worker     # Start compiled workers
npm run test             # Run all tests (Vitest)
npm run prisma:migrate   # Apply Prisma migrations
npm run prisma:studio    # Open Prisma Studio
```

---

# 16. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS + TypeScript 5 | Stable LTS |
| Web framework | Express 4 | Spec-mandated |
| ORM | Prisma 5 | Type-safe migrations |
| Session store | express-session + connect-pg-simple | Reuses PG pool; no extra dependency |
| OAuth | passport + passport-google-oauth20, passport-slack-oauth2 | Mature libraries |
| Validation | Zod | TypeScript-native; powers OpenAPI generation |
| Queue | BullMQ 5 | Spec-mandated |
| Email | Nodemailer + Ethereal | Spec-mandated |
| Encryption | Node.js crypto (AES-256-GCM) | No extra dependency |
| Logging | Pino | Structured JSON logs; fast |
| API docs | swagger-ui-express + zod-to-openapi | Auto-generated from Zod schemas |
| Testing | Vitest + Supertest | Fast TS-native runner |
| Linting | ESLint + Prettier | Standard |

---

# Part II — Specification Review & Implementation Plan

---

# 17. Ambiguities Resolved

| # | Issue | Decision |
|---|---|---|
| A | Duplicate recipients — remove or reject? | Silently deduplicate; return `deduplicatedCount` in response |
| B | Rate-limit scope unclear (GLOBAL vs USER vs SENDER) | `min(GLOBAL_HOURLY_LIMIT, campaign.hourlyLimit)` scoped per `USER:{userId}` |
| C | Job ID collision after rescheduling | Generation-based: `email-{emailRecordId}-gen-{retryCount}` |
| D | `DELIVERY_UNKNOWN` referenced in §9.7 but not formalized | Added to lifecycle table, transitions, campaign aggregate logic, reconciliation |
| E | Cancellation of `active` BullMQ jobs | DB status check is the authoritative safety net; worker exits if `CANCELLED` |
| F | Session store backend not specified | `connect-pg-simple` — reuses existing PG connection |
| G | Encryption algorithm unspecified | AES-256-GCM via Node `crypto`; key from `ENCRYPTION_KEY` env var |
| H | Outbox publisher: polling vs event-driven | `setInterval` loop + Redis `SET NX EX` distributed lock; interval configurable |
| I | Which ES events trigger re-indexing | All status transitions (idempotent by document ID) |
| J | Bull Board admin auth mechanism | `role` column on `users` table; `requireAdmin` middleware |
| K | `startAt` grace window | 60-second grace window; treat as immediate if within window; `START_TIME_IN_PAST` error if rejected |
| L | `sequence_number` indexing | 1-indexed for human readability |
| M | Campaign status update strategy | Eagerly updated after each email record status transition |

---

# 18. Additional Schema Additions vs Original Spec

| Addition | Location | Reason |
|---|---|---|
| `outbox_events` table | Prisma schema | Required for transactional outbox pattern |
| `role` column on `users` | Prisma schema | Required for admin vs. user authorization |
| `ENCRYPTION_KEY` env var | `.env.example` | AES-256-GCM key for token/credential encryption |
| `OUTBOX_POLL_INTERVAL_MS` | `.env.example` | Outbox publisher polling interval |
| `RECONCILIATION_POLL_INTERVAL_MS` | `.env.example` | Reconciliation worker polling interval |
| `MAX_RECIPIENTS_PER_CAMPAIGN` | `.env.example` | Request-level recipient count guard |
| `deduplicatedCount` in schedule response | API contract | Reports silently removed duplicates |
| `DELIVERY_UNKNOWN` status | Prisma enum + lifecycle | Formalized from §9.7 recommendation |
| `crypto.util.ts` | `src/shared/utils/` | Encryption utility |
| `smtp-error-classifier.ts` | `src/shared/utils/` | Retry vs. permanent failure classification |
| `pagination.util.ts` | `src/shared/utils/` | Shared pagination helper |
| `idempotency.middleware.ts` | `src/middleware/` | Idempotency-Key header handling |

---

# 19. Key Engineering Risks & Mitigations

| Risk | Mitigation |
|---|---|
| SMTP accepted but DB update failed → duplicate on retry | `DELIVERY_UNKNOWN` status + reconciliation TTL; document as known limitation |
| Outbox publisher crashes mid-publish → duplicate BullMQ jobs | Deterministic generation-based IDs prevent BullMQ duplicates; DB status check prevents double-send |
| Redis unavailable → rate limit bypassed | Fail-closed: worker catches Redis errors and does NOT proceed to send |
| Two workers race on last rate-limit slot | Atomic Lua script with sorted-set semantics prevents race |
| BullMQ delayed job fires after campaign cancelled | Worker checks DB status as first action; exits if `CANCELLED` |
| Large campaigns (500 recipients) → slow API response | `createMany` in Prisma; bulk outbox events; `202 Accepted` returned immediately |
| `startAt` slightly in the past due to network delay | 60-second grace window; effective startAt set to server time |

---

# 20. Implementation Phases

Build and test the backend sequentially. Each phase's test gate must pass before the next phase begins.

## Phase 1 — Project Foundation
**Goal:** Running skeleton with database, Redis, and health check.

**Deliverables:**
1. TypeScript config, ESLint, Prettier.
2. `src/config/env.ts` — validates all env vars at startup using Zod; throws on missing required values.
3. `src/config/database.ts` — Prisma client singleton.
4. `src/config/redis.ts` — IORedis client singleton with reconnect logic.
5. `src/config/session.ts` — express-session with `connect-pg-simple`.
6. `src/app.ts` — Express app factory (middleware stack, no routes yet).
7. `src/server.ts` — starts HTTP listener.
8. `src/worker.ts` — worker entry point (placeholder).
9. `GET /health` — returns `{ postgres: "ok", redis: "ok", elasticsearch: "ok" }`.
10. Docker Compose with `postgres`, `redis`, `elasticsearch`.
11. Prisma schema skeleton (users table only, with `role`).
12. `.env.example`.

**Test gate:** `npm run dev` starts; `curl /health` returns 200 with all services OK.

---

## Phase 2 — Database Schema & Core APIs
**Goal:** Full schema, campaign creation, and email list endpoints (no actual sending).

**Deliverables:**
1. Complete Prisma schema (all 8 tables + enums including `DELIVERY_UNKNOWN` and `outbox_events`).
2. Migrations with all indexes and constraints.
3. Repository layer: `campaign.repository.ts`, `email-record.repository.ts`, `email-event.repository.ts`, `idempotency.repository.ts`.
4. Service layer: `campaign.service.ts`, `email.service.ts`.
5. Zod validation schemas including `startAt` grace window logic.
6. All campaign and email routes/controllers.
7. Idempotency middleware.
8. Centralized error middleware.
9. Pagination utility.

**Test gate:** Create campaign via Postman → records in DB → duplicate request returns cached response → paginated lists return correct data → `startAt` boundary cases behave correctly.

---

## Phase 3 — BullMQ Scheduling & Outbox
**Goal:** Jobs created after campaign creation; outbox pattern implemented.

**Deliverables:**
1. Queue connection, constants, and registry.
2. `scheduler.service.ts` — calculates `scheduledAt` per recipient, creates outbox events in same DB transaction.
3. `outbox.worker.ts` — polls `outbox_events` where `published_at IS NULL`, adds BullMQ delayed jobs, sets `published_at`. Uses Redis `SET NX EX` distributed lock.
4. `reconciliation.worker.ts` — polls for `SCHEDULED` records with no active BullMQ job; recreates jobs.
5. Generation-based job ID strategy.

**Test gate:** Create campaign → outbox event → outbox worker → BullMQ delayed job visible in Bull Board → restart outbox worker → unpublished events re-processed.

---

## Phase 4 — SMTP & Email Sending Worker
**Goal:** Scheduled jobs send emails via Ethereal.

**Deliverables:**
1. `email-provider.interface.ts`.
2. `ethereal.provider.ts` — logs Ethereal preview URL.
3. `email-sending.worker.ts` — full processing sequence with status check, SMTP send, DB update, `DELIVERY_UNKNOWN` handling.
4. `smtp-error-classifier.ts`.
5. Retry configuration via env vars.
6. Failed job handling.

**Test gate:** Schedule campaign 1 minute ahead → Ethereal preview URL in logs → email record status = `SENT` → simulate SMTP failure → retry behavior correct → permanent failure marks `FAILED`.

---

## Phase 5 — Rate Limiting
**Goal:** Hourly limit enforced atomically across multiple workers.

**Deliverables:**
1. `rate-limiter.lua.ts` — atomic Lua sliding-window script.
2. `rate-limiter.service.ts` — exposes `tryReserve(userId, campaignLimit)`.
3. Inter-email delay enforcement in `scheduler.service.ts`.
4. Rate-limit check in email-sending worker with reschedule + `EMAIL_RATE_LIMITED` event.
5. Redis deduplication key for notification.
6. Notification job enqueued to `notification` queue when limit first reached.
7. `notification.worker.ts` stub (full Slack in Phase 6).

**Test gate:** Set `hourlyLimit: 2` with 5 recipients → 2 send → 3 rescheduled → run 2 concurrent workers → total per hour never exceeds 2.

---

## Phase 6 — Authentication & Slack
**Goal:** Google login works; all endpoints protected; Slack notifications sent.

**Deliverables:**
1. Passport.js + Google OAuth 2.0 strategy.
2. `auth.service.ts` — find-or-create user logic.
3. Session creation, regeneration, destruction.
4. `requireAuth` and `requireAdmin` middleware.
5. Ownership checks in all repositories.
6. All auth routes.
7. Slack OAuth flow (connect, callback, status, disconnect, test).
8. `crypto.util.ts` — AES-256-GCM encrypt/decrypt.
9. `notification.worker.ts` — full Slack API integration with error handling.
10. Sender account APIs.

**Test gate:** Full Google login → all endpoints reject unauthenticated → Slack test notification → Slack disconnect doesn't affect email delivery.

---

## Phase 7 — Elasticsearch & Bull Board
**Goal:** Full-text search; queue monitoring.

**Deliverables:**
1. Elasticsearch client and index mapping.
2. `ES_INDEX` outbox event type; indexing worker.
3. `search.service.ts` — always filters by `userId`.
4. Search integrated into scheduled/sent email list endpoints.
5. Bull Board at `/admin/queues` behind `requireAdmin`.
6. `GET /api/v1/admin/queue/stats`.

**Test gate:** Send 10 emails → search by recipient returns correct results → cross-user isolation verified → Bull Board shows queue state → ES unavailability doesn't block sending.

---

## Phase 8 — Hardening & Tests
**Goal:** All failure scenarios tested; production-ready quality.

**Deliverables:**
1. Unit tests for all business logic.
2. Integration tests for all inter-module flows.
3. E2E tests and documented failure scenario tests.
4. `README.md` with full setup instructions.
5. OpenAPI/Swagger spec (auto-generated).
6. Final `.env.example` review.

**Test gate:** All 14 failure scenarios from §13.4 pass; no critical secrets exposed; app starts using documented commands.

---

# 21. Phased Effort Estimate

| Phase | Description | Estimated Effort |
|---|---|---|
| Phase 1 | Project Foundation | ~4 hours |
| Phase 2 | Database Schema & Core APIs | ~8 hours |
| Phase 3 | BullMQ Scheduling & Outbox | ~6 hours |
| Phase 4 | SMTP & Email Sending Worker | ~5 hours |
| Phase 5 | Rate Limiting | ~6 hours |
| Phase 6 | Authentication & Slack | ~7 hours |
| Phase 7 | Elasticsearch & Bull Board | ~5 hours |
| Phase 8 | Hardening & Tests | ~8 hours |
| **Total** | | **~49 hours** |

> Phases 5 and 6 can be developed in parallel if separate developers handle rate-limiting and auth respectively.

---

# 22. Backend Completion Checklist

### Foundation
- [ ] TypeScript and Express setup complete.
- [ ] PostgreSQL connected.
- [ ] Redis connected.
- [ ] Prisma migrations working.
- [ ] Docker Compose working.
- [ ] Centralized error handling implemented.

### Database and APIs
- [ ] All required tables created (including `outbox_events`, `role` on users).
- [ ] Campaign creation API working.
- [ ] Individual email records created per recipient.
- [ ] Duplicate recipient deduplication working; `deduplicatedCount` returned.
- [ ] `startAt` grace window validation working.
- [ ] Idempotency implemented.
- [ ] Scheduled, sent, and failed email APIs working.
- [ ] Campaign cancellation working.

### Scheduling and Workers
- [ ] BullMQ queues configured.
- [ ] Delayed jobs working.
- [ ] Transactional outbox implemented.
- [ ] Outbox publisher working with distributed lock.
- [ ] Email sending worker working.
- [ ] Ethereal SMTP integrated.
- [ ] `DELIVERY_UNKNOWN` status handling implemented.
- [ ] Worker restart recovery tested.
- [ ] Reconciliation worker working.

### Rate Limiting
- [ ] Redis-based distributed sliding-window limiter working.
- [ ] Effective limit = `min(GLOBAL_HOURLY_LIMIT, campaign.hourlyLimit)`.
- [ ] Hourly limit enforced per user scope.
- [ ] Inter-email delay enforced.
- [ ] Excess emails rescheduled with generation-based job IDs.
- [ ] Notification deduplication implemented.
- [ ] Concurrent worker test passed (2+ workers, limit not exceeded).

### Authentication and Integrations
- [ ] Google OAuth working.
- [ ] Session authentication working (`connect-pg-simple`).
- [ ] User ownership checks implemented (all queries scoped to `userId`).
- [ ] Slack OAuth working.
- [ ] Slack notification working.
- [ ] AES-256-GCM token encryption working.
- [ ] Disconnect and reconnect working.
- [ ] Admin role enforcement working.

### Search and Monitoring
- [ ] Elasticsearch indexing working.
- [ ] Search API working with `userId` isolation.
- [ ] Indexing failures do not interrupt sending.
- [ ] Bull Board integrated at `/admin/queues`.
- [ ] Admin-only access enforced.

### Quality
- [ ] OpenAPI/Swagger documentation available.
- [ ] Unit tests written.
- [ ] Integration tests written.
- [ ] All failure scenarios from §13.4 tested.
- [ ] Restart and recovery tested.
- [ ] README completed.
- [ ] `.env.example` completed.

---

# 23. Final Architecture Rule

**PostgreSQL is the source of truth. Redis/BullMQ is the execution mechanism. Workers execute business operations. The API coordinates and exposes functionality.**

- Never make the frontend responsible for scheduling or sending emails.
- Never make the API server wait until a scheduled time.
- Never rely solely on Redis to determine whether an email has been sent.
- Never assume a completed BullMQ job means a successfully delivered email.
- Never bypass rate limiting when Redis is unavailable.
- Never assume an SMTP timeout means the message was not accepted — use `DELIVERY_UNKNOWN`.
- Every major action must be traceable through the database and application logs.
- The backend must be fully testable through API requests and independent worker processes before frontend development begins.

