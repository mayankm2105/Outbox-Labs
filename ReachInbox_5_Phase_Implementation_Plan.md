REACHINBOX

5-Phase Implementation Plan

Backend-first development, verification, API freeze, then frontend
integration

| Principle \| Decision \|

| --- \| --- \|

| Development order \| Phases 1--4 are backend-only. Phase 5 is frontend
  and integration. \|

| Backend source of truth \| PostgreSQL stores durable business state.
  \|

| Background execution \| BullMQ + Redis; no cron jobs or cron
  libraries. \|

| Email provider \| Ethereal SMTP for test-only email sending. \|

| Integration discipline \| Frontend is built against a documented,
  tested, frozen API contract. \|

| Definition of done \| Every phase has tests, evidence, and explicit
  exit criteria. \|

# How to use this document

Treat this document as the project implementation specification. Give
Antigravity only the current phase and ask it to implement that phase
without starting later phases. Review the code, run the listed tests,
and approve the phase before proceeding. Do not let the coding agent
silently change API contracts, database design, or project dependencies.

The assignment explicitly requires TypeScript + Express, BullMQ backed
by Redis, PostgreSQL or MySQL, Ethereal SMTP, Elasticsearch search, a
live BullMQ dashboard, configurable worker concurrency, a minimum delay
between sends, hourly rate limits safe across workers, Slack OAuth
notifications, restart persistence, and a React or Next.js frontend with
real Google OAuth.

# 1. Scope and system boundaries

The system accepts email campaign requests, stores campaign and
recipient records, schedules individual email work, sends through one of
several Ethereal SMTP sender accounts, and exposes searchable
scheduled/sent/failed email history.

| Component \| Responsibility \| Source of truth? \|

| --- \| --- \| --- \|

| React frontend (Phase 5) \| Login UI, compose form, scheduled/sent
  tables, campaign progress \| No \|

| Express API \| Authentication, validation, business operations, API
  responses \| No \|

| PostgreSQL \| Users, senders, campaigns, recipients, status history,
  outbox \| Yes \|

| BullMQ + Redis \| Delayed jobs, queue state, distributed job execution
  \| Execution state; not business source of truth \|

| Workers \| Schedule, send, retry, reconcile, notify, index \| No \|

| Ethereal SMTP \| Accept test email submissions and provide preview \|
  External provider \|

| Elasticsearch \| Search index for email/campaign records \| No;
  rebuildable projection \|

| Bull Board \| Operational visibility into BullMQ queues \| No \|

| Slack \| External notification when sender hourly limit is hit \|
  External integration \|

## Non-negotiable engineering rules

-   Do not use cron, node-cron, Agenda, OS crontab, or any cron-like
    scheduler. Use BullMQ delayed jobs.

-   PostgreSQL is the authoritative record for users, campaigns, email
    statuses, and configuration.

-   Do not send emails inside an HTTP request. The API persists work and
    returns; workers send asynchronously.

-   Do not rely on in-memory counters for rate limiting. Use Redis
    atomic operations or a database-backed equivalent.

-   Use deterministic job IDs and idempotent state transitions to reduce
    duplicate processing.

-   Do not claim exactly-once SMTP delivery. SMTP acceptance can be
    ambiguous if a worker crashes before recording the result.

-   Do not let Slack or Elasticsearch outages stop core email
    scheduling/sending.

-   Do not expose SMTP passwords, OAuth access tokens, refresh tokens,
    or session secrets to the frontend or logs.

-   Keep frontend work out of Phases 1--4. Verify the backend with
    automated tests and an API client first.

# 2. Proposed repository structure

``` text
reachinbox/
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/                 # env, postgres, redis, elasticsearch
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── senders/
│   │   │   ├── campaigns/
│   │   │   ├── emails/
│   │   │   └── slack/
│   │   ├── queues/                 # BullMQ queue declarations/producers
│   │   ├── workers/                # separate worker entrypoints/processors
│   │   ├── services/               # SMTP, rate-limit, Slack, search
│   │   ├── repositories/            # database access
│   │   ├── middleware/              # auth, validation, errors
│   │   ├── database/                # migrations, seeds
│   │   ├── observability/           # structured logging, metrics
│   │   └── shared/                  # errors, types, constants
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── frontend/                        # created only in Phase 5
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Use a modular monolith: one backend codebase with clearly separated API
and worker processes. This is simpler to build and deploy than
microservices, while still keeping HTTP handling separate from
background processing.

# 3. Phase 1 --- Backend foundation, infrastructure, database and auth foundation

Goal: create a backend that starts reliably, connects to PostgreSQL and
Redis, has migrations, consistent error handling, configuration
validation, and a secure authentication foundation. No email sending or
frontend UI yet.

## Implementation tasks

-   Create the monorepo root and backend TypeScript project. Configure
    strict TypeScript, linting, formatting, scripts, and
    environment-specific configuration.

-   Create Docker Compose services for PostgreSQL, Redis, and
    Elasticsearch. Add health checks and persistent Docker volumes. Keep
    application containers optional initially.

-   Create Express app and server entrypoints separately. Add
    /health/live and /health/ready endpoints; readiness must check
    required dependencies.

-   Implement validated environment loading. Fail fast at startup if
    required configuration is missing or malformed. Provide .env.example
    with placeholders only.

-   Choose one ORM/query layer (recommended: Prisma or Drizzle) and use
    migrations. Do not mix multiple database access patterns.

-   Design and migrate core tables: users, sender_accounts,
    email_campaigns, email_records, email_events, idempotency_keys,
    outbox_events, slack_integrations. Add indexes and foreign keys.

-   Define enums/statuses and ownership relationships. A campaign
    belongs to one user; email records belong to a campaign and user;
    sender belongs to a user/tenant.

-   Implement common API response/error format, request validation,
    request IDs, structured logging, and centralized error middleware.

-   Implement backend Google OAuth endpoints and server-side session
    handling (secure, HttpOnly, SameSite cookie; state validation; CSRF
    protection where applicable). The login screen is deferred to Phase
    5.

-   Add authentication middleware and a /api/v1/auth/me endpoint. Add
    logout and session invalidation.

-   Add database seed script for local development only. Never seed real
    credentials or tokens.

## Database design baseline

| Table \| Minimum important fields \|

| --- \| --- \|

| users \| id, google_subject (unique), email (unique), name,
  avatar_url, created_at, updated_at \|

| sender_accounts \| id, user_id, display_name, smtp_host, smtp_port,
  smtp_secure, smtp_username, encrypted_smtp_password, status,
  created_at \|

| email_campaigns \| id, user_id, sender_account_id, name, subject,
  body, requested_start_at, effective_start_at, min_delay_seconds,
  hourly_limit, status, total_count, created_at \|

| email_records \| id, campaign_id, user_id, sender_account_id,
  recipient_email, normalized_recipient, status, scheduled_at, sent_at,
  attempt_count, provider_message_id, last_error_code,
  last_error_message, created_at, updated_at \|

| email_events \| id, email_record_id, event_type, details_json,
  created_at \|

| idempotency_keys \| id, user_id, key, request_hash, resource_id,
  created_at; unique(user_id,key) \|

| outbox_events \| id, event_type, aggregate_id, payload_json, status,
  attempts, available_at, processed_at, created_at \|

| slack_integrations \| id, user_id, team_id, encrypted_access_token,
  encrypted_refresh_token, scopes, connected_at, disconnected_at \|

This is a starting schema, not a command to blindly copy fields. Review
nullability, unique constraints, indexes, encryption strategy, deletion
behavior, and migrations before implementation. Keep SMTP credentials
and OAuth tokens encrypted at rest.

## API foundation

| Endpoint \| Purpose \| Expected result \|

| --- \| --- \| --- \|

| GET /health/live \| Process is alive \| 200 \|

| GET /health/ready \| Required dependencies are reachable \| 200 or 503
  \|

| GET /api/v1/auth/google \| Begin Google OAuth \| Redirect to Google \|

| GET /api/v1/auth/google/callback \| Validate OAuth callback and
  establish session \| Redirect to app callback/dashboard \|

| GET /api/v1/auth/me \| Return authenticated user profile \| User DTO
  \|

| POST /api/v1/auth/logout \| Invalidate session \| 204 or success
  response \|

## Phase 1 tests and exit criteria

-   Fresh clone → documented commands start PostgreSQL, Redis,
    Elasticsearch, and backend.

-   Database migrations run from an empty database and can be applied
    repeatedly safely.

-   Readiness endpoint fails when a required dependency is stopped and
    recovers when it returns.

-   Invalid/missing environment variables cause a clear startup failure.

-   Unauthenticated protected endpoint returns 401; authenticated
    /auth/me returns the correct user.

-   OAuth state mismatch, invalid callback, and logout/session
    invalidation are tested.

-   All secrets are absent from API responses and logs.

-   Commit schema diagram or table documentation and update README setup
    instructions.

Phase 1 is complete only when the backend foundation is reproducible
from a clean checkout. Do not start queue or SMTP implementation before
this gate passes.

# 4. Phase 2 --- Campaign APIs, BullMQ scheduling and SMTP sending

Goal: implement the core user journey through APIs: create a campaign,
validate recipients, persist each email, schedule work with BullMQ
delayed jobs, send using Ethereal SMTP, and track results. This phase
still has no frontend.

## Implementation tasks

-   Implement sender-account CRUD and validation. Support multiple
    Ethereal SMTP sender accounts per user. Verify SMTP connectivity
    with a test connection/send preview where practical.

-   Implement campaign creation API. Accept campaign metadata, subject,
    body, recipient list or parsed CSV/text payload, sender ID, startAt,
    minimum delay, hourly limit, and Idempotency-Key.

-   Validate ownership of sender account; validate email syntax; trim
    recipient values; apply a documented duplicate-normalization policy;
    report invalid and deduplicated counts.

-   Use a 60-second startAt grace window: accept startAt \>= serverNow -
    60 seconds; if it is in the past but within grace, persist
    effectiveStartAt=serverNow; reject older timestamps. Compare UTC
    instants using server clock.

-   Persist campaign and email records in one database transaction. Save
    requestedStartAt and effectiveStartAt separately for auditability.

-   Write outbox events in the same transaction as campaign/email
    records. A publisher process reads unprocessed outbox rows and adds
    BullMQ jobs, then marks events published. Make publishing
    idempotent.

-   Create queue definitions with typed job payloads containing IDs, not
    entire email bodies or credentials. Use deterministic job IDs
    derived from durable record IDs.

-   Implement scheduling worker: when the campaign becomes eligible,
    enqueue individual email jobs or bounded batches. Do not enqueue an
    unbounded amount of in-memory work.

-   Implement sending worker: load current email/campaign/sender data
    from PostgreSQL, verify state, send through SMTP service, and
    persist status/event changes.

-   Implement SMTP abstraction so worker logic does not directly depend
    on a specific SMTP library. Store provider message ID and sanitized
    error information.

-   Implement API endpoints for listing campaigns, scheduled emails,
    sent/failed emails, individual email details, and campaign details
    with pagination and filters.

-   Add cancellation behavior for campaigns/emails where safe. Define
    what happens to already-processing jobs and ensure cancelled records
    are not sent when workers re-check state.

## Core status model

| Entity \| Suggested statuses \| Meaning \|

| --- \| --- \| --- \|

| Email \| SCHEDULED \| Persisted and waiting for its scheduled send
  time. \|

| Email \| PROCESSING \| A worker has claimed the email and is
  attempting delivery. \|

| Email \| RETRY_SCHEDULED \| A retry is planned after a transient
  failure. \|

| Email \| SENT \| SMTP accepted the message; this does not prove inbox
  delivery. \|

| Email \| FAILED \| Permanent failure or retries exhausted. \|

| Email \| CANCELLED \| Cancelled before send. \|

| Email \| DELIVERY_UNKNOWN \| Optional: provider outcome is ambiguous;
  requires safe reconciliation, not blind retry. \|

| Campaign \| SCHEDULED / PROCESSING \| Waiting to start / at least one
  email is being processed. \|

| Campaign \| COMPLETED / PARTIALLY_COMPLETED / FAILED / CANCELLED \|
  Derived from terminal email outcomes and cancellation. \|

## Suggested API contract

| Method + route \| Purpose \|

| --- \| --- \|

| POST /api/v1/senders \| Create sender account \|

| GET /api/v1/senders \| List current user's senders \|

| POST /api/v1/senders/:senderId/test \| Test SMTP configuration \|

| DELETE /api/v1/senders/:senderId \| Disable/remove sender safely \|

| POST /api/v1/campaigns \| Create and schedule a campaign \|

| GET /api/v1/campaigns \| List campaigns with pagination \|

| GET /api/v1/campaigns/:campaignId \| Campaign summary and counts \|

| POST /api/v1/campaigns/:campaignId/cancel \| Cancel eligible pending
  work \|

| GET /api/v1/emails?status=scheduled \| List scheduled emails \|

| GET /api/v1/emails?status=sent \| List sent emails \|

| GET /api/v1/emails?status=failed \| List failed emails \|

| GET /api/v1/emails/:emailId \| Email detail and event history \|

## Campaign creation request example

``` text
POST /api/v1/campaigns
Idempotency-Key: <unique-client-generated-key>

{
  "name": "November update",
  "senderAccountId": "sender_123",
  "subject": "Important update",
  "body": "Hello ...",
  "recipients": ["one@example.com", "two@example.com"],
  "startAt": "2026-11-03T11:00:00.000Z",
  "minDelaySeconds": 2,
  "hourlyLimit": 100
}
```

Return 202 Accepted after durable records and the outbox event are
committed. Include campaignId, counts (accepted, invalid, deduplicated),
status, and effectiveStartAt. Do not wait for actual email sending in
the HTTP request.

## Phase 2 tests and exit criteria

-   Create campaign with valid recipients; verify campaign and one email
    record per unique valid recipient.

-   Duplicate recipients within one campaign are handled according to
    documented policy and deduplicatedCount is correct.

-   Invalid recipients are reported and are not queued.

-   StartAt in future is preserved; now/past within 60 seconds becomes
    immediate; older than 60 seconds is rejected.

-   Repeated POST with same Idempotency-Key and same request returns the
    original campaign; key reuse with a different request returns
    conflict.

-   Queue jobs use deterministic IDs and duplicate outbox publishing
    does not create duplicate logical email sends.

-   Email does not send before effectiveStartAt. At/after time it is
    picked up by a worker.

-   Successful Ethereal send records SENT and provider metadata;
    permanent SMTP failure records FAILED; transient failure schedules
    retry.

-   Stop and restart API/worker during a future schedule; future jobs
    still execute.

-   API list/detail endpoints enforce ownership and return stable
    paginated DTOs.

# 5. Phase 3 --- Throughput, rate limits, recovery, Slack, Elasticsearch and Bull Board

Goal: make the scheduler safe under parallel workers and load,
observable to an operator, and resilient to process restarts and
optional integration outages.

## Implementation tasks

-   Make worker concurrency configurable via environment variables.
    Separate concurrency configuration from rate limiting; concurrency
    controls parallel work, not allowed send volume.

-   Implement minimum delay between sends. Enforce the configured
    minimum delay at the sender scope across workers/instances, not with
    per-process sleep alone. Document whether the policy is global or
    per sender and test that policy.

-   Implement hourly rate limit with Redis atomic reservation (Lua
    script or equivalent). Scope it per sender or tenant as defined by
    configuration. Do not use in-memory counters.

-   When the hourly limit is exhausted, do not fail/drop the email.
    Calculate the next eligible time and reschedule it while preserving
    order as much as practical. Use a deterministic job ID and update
    scheduledAt/status consistently.

-   Ensure the hourly limit and inter-send delay are both enforced. A
    free hourly slot does not override the minimum-delay rule.

-   Implement retry classification: transient SMTP/network failures
    retry with exponential backoff + jitter and a bounded attempt count;
    permanent validation/auth failures do not retry indefinitely.

-   Handle ambiguous SMTP outcome explicitly. Do not automatically
    resend when provider acceptance may have occurred but DB status was
    not committed; mark/record uncertain state and document
    reconciliation policy.

-   Implement graceful worker shutdown: stop claiming new jobs, allow
    active work to finish within timeout, close queue/Redis/DB
    connections.

-   Implement recovery/reconciliation using durable PostgreSQL state and
    outbox. On process startup, reconcile scheduled records with missing
    queue jobs and recover unprocessed outbox events. No cron.

-   Implement Slack OAuth authorize/callback/disconnect/reconnect
    endpoints. Encrypt tokens at rest. When a sender hits its limit,
    enqueue a deduplicated notification job and make a live Slack API
    call.

-   If Slack is disconnected or the token is invalid, log/record
    notification failure without crashing or blocking email sending. A
    later reconnect must work without redeploy.

-   Implement Elasticsearch index mapping and indexing worker. Index
    scheduled/sent/failed email documents and relevant searchable
    fields. PostgreSQL remains authoritative.

-   Use outbox events to drive Elasticsearch indexing; make indexing
    idempotent by document ID. Add reindex/retry strategy.

-   Implement search API with user/tenant scoping, pagination, filters,
    and query validation. Never allow cross-user search leakage.

-   Expose Bull Board behind authentication and preferably an
    admin/operations role or restricted local access. Do not expose an
    unauthenticated public queue dashboard.

-   Add structured logs, correlation/request IDs, queue metrics, worker
    health, and basic operational diagnostics.

## Rate-limit design requirements

Use Redis as the shared coordination point. The reservation must be
atomic so two workers cannot both consume the final available slot.
Store enough timestamps/state to enforce the chosen hourly window and
minimum delay. Decide and document whether the hourly window is a
rolling 60-minute window or a calendar-hour window; do not mix the two.
For a rolling window, a sorted-set sliding window is suitable. For a
fixed window, use a counter with a carefully defined expiry. The
assignment's example permits either global or per-sender/per-tenant
limits; per-sender is a natural fit when using multiple sender accounts.

## Slack notification behavior

-   Send a notification only when a sender transitions into the
    rate-limited state, not for every blocked email.

-   Deduplicate notifications by sender + limit window so a 1,000-email
    backlog does not generate 1,000 Slack messages.

-   Notification queue failure or Slack outage must not fail or block
    email records.

-   After disconnect, stop using the token. After reconnect,
    notifications resume using the new valid credentials.

## Phase 3 tests and exit criteria

-   Run multiple sending workers/processes and prove hourly limit is
    never exceeded.

-   Prove minimum inter-send spacing is respected across workers for the
    documented scope.

-   At hourly cap, jobs remain scheduled/rescheduled and later resume;
    they are not marked FAILED.

-   Run 1,000+ scheduled records in a load test or simulation; API
    remains responsive and work is processed in bounded batches.

-   Kill worker during processing and restart; reconcile pending work
    without restarting the campaign from the beginning.

-   Test retryable vs permanent errors and ambiguous SMTP outcome
    handling.

-   Disconnect Slack: sending continues without crash. Reconnect Slack:
    a subsequent limit event produces a real Slack message.

-   Verify Elasticsearch documents appear after outbox processing; stop
    Elasticsearch and prove PostgreSQL writes/sends continue; restart
    and verify indexing catches up.

-   Verify search results are scoped to the authenticated user and
    filters/pagination work.

-   Verify Bull Board is reachable only by authorized users and displays
    queues/jobs.

-   Document all concurrency, delay, rate-limit, retry, and recovery
    settings in .env.example and README.

# 6. Phase 4 --- Backend verification, hardening and API freeze

Goal: treat the backend as a standalone deliverable. Test it without a
frontend, fix contract inconsistencies, prove restart persistence and
load behavior, and freeze the API before frontend work begins.

## Verification work

-   Create an automated test pyramid: unit tests for
    validation/rate-limit math/status transitions; integration tests for
    PostgreSQL/Redis/BullMQ/SMTP adapter; end-to-end API tests using a
    real local stack.

-   Create a Postman or Bruno collection for auth, sender CRUD, campaign
    creation, campaign listing/detail/cancel, scheduled/sent/failed
    lists, search, Slack OAuth, and operational health.

-   Add deterministic test SMTP mode or Ethereal test account
    configuration. Tests must not depend on real recipients receiving
    email.

-   Test persistence scenario required by assignment: schedule future
    emails, stop API and workers, restart services, and verify future
    emails send at the intended time without duplicates or resetting
    progress.

-   Test idempotency: repeated request, duplicate job publication,
    worker retry, worker restart, and concurrent workers.

-   Test 1,000+ email scheduling load with controlled fake SMTP or a
    stub transport to avoid provider limitations. Record throughput,
    queue depth, latency, and memory behavior.

-   Test rate-limit boundary, inter-send delay, ordering behavior, and
    simultaneous workers.

-   Test authorization/ownership for every endpoint; test malformed
    payloads, oversized recipient lists, invalid dates, and invalid
    sender IDs.

-   Test optional dependency outages: Slack unavailable, Elasticsearch
    unavailable, Redis unavailable, SMTP unavailable. Define which
    operations fail closed and which can continue safely.

-   Review logs for secrets and personal data. Redact tokens, SMTP
    credentials, and message bodies where not needed.

-   Generate OpenAPI documentation or a clearly versioned API contract
    with request/response examples, status codes, error codes,
    pagination, auth behavior, and timestamp semantics.

-   Freeze the API DTOs and frontend-facing behavior. Any later breaking
    change must be explicitly versioned or agreed before frontend
    implementation.

-   Update README: architecture, local setup, env vars, migrations,
    start API, start workers, queue dashboard, Ethereal setup, Slack
    setup, Elasticsearch, tests, restart proof, rate limit/concurrency
    policy, known trade-offs.

## Required end-to-end test scenarios

| Scenario \| Expected outcome / evidence \|

| --- \| --- \|

| Schedule future campaign \| API returns 202; records saved; BullMQ
  delayed work exists; no early send. \|

| Immediate campaign \| Within grace window, effective start is now;
  worker processes it promptly. \|

| Past timestamp outside grace \| 400 START_TIME_IN_PAST. \|

| Duplicate API request \| Same campaign returned; no second campaign or
  duplicate email records. \|

| 1,000+ recipients \| Records/jobs handled in batches; API does not
  synchronously send all mail. \|

| Hourly limit reached \| Pending jobs rescheduled; Slack alert sent
  once per sender/window. \|

| Multiple workers \| Shared Redis coordination enforces cap and delay.
  \|

| Restart before scheduled time \| Future emails still send at the right
  time after restart. \|

| Restart during processing \| No campaign reset; no blind duplicate
  resend; ambiguous result is recorded safely. \|

| Search \| Scheduled/sent/failed results searchable and user-scoped. \|

| Bull Board \| Live queue visibility available only to authorized
  operator. \|

## Phase 4 exit gate --- do not start frontend until all are true

-   All required backend features are implemented or explicitly
    documented as a known limitation.

-   All automated tests pass from a clean local environment.

-   Postman/Bruno happy-path and failure-path collection passes.

-   Restart persistence demo has been recorded or repeatably
    demonstrated.

-   Rate-limit/concurrency tests pass with multiple workers.

-   Slack live notification and Elasticsearch search have been verified.

-   OpenAPI/API contract is stable and includes exact frontend DTOs.

-   README setup is reproducible by someone who did not build the
    project.

# 7. Phase 5 --- Frontend development and backend integration

Start this phase only after Phase 4 is signed off. Use React or Next.js
with TypeScript and Tailwind. The frontend must consume the frozen
backend API; it must not duplicate backend business rules.

## Frontend implementation tasks

-   Create frontend app, TypeScript config, Tailwind, routing, linting,
    reusable UI components, API client, and environment config.

-   Implement Google login using the backend OAuth flow. Do not create a
    fake frontend-only login. Handle authenticated, unauthenticated,
    loading, and expired-session states.

-   Implement dashboard shell with user name, email, avatar, logout,
    Scheduled Emails and Sent Emails sections, and Compose New Email
    action.

-   Implement compose form: sender selection, subject, body, CSV/text
    upload, detected recipient count, start time, minimum delay, hourly
    limit, validation, preview, and schedule action.

-   Parse CSV/text client-side for user feedback, but treat backend
    parsing/validation as authoritative. Display accepted, invalid, and
    deduplicated counts from API response.

-   Implement scheduled email table with recipient, subject, scheduled
    time, and status. Include loading, empty, pagination, refresh, and
    error states.

-   Implement sent/failed table with recipient, subject, sent time,
    status, and useful failure detail where safe.

-   Implement campaign detail/progress view if time allows; show total,
    scheduled, sent, failed, and pending counts.

-   Implement sender management UI and Slack connect/disconnect UI if
    included in the agreed scope.

-   Implement search UI against the backend search endpoint. Do not
    query Elasticsearch directly from the browser.

-   Handle 401/403, validation errors, 409 idempotency conflicts,
    429/5xx, network failures, and expired sessions consistently.

-   Add responsive layout and match the provided Figma design as closely
    as possible. Keep components reusable and avoid duplicating API
    logic.

-   Run end-to-end tests against the actual backend, not mocked
    responses, before final demo.

## Frontend-to-backend integration map

| Frontend screen/action \| Backend endpoint \|

| --- \| --- \|

| Login with Google \| GET /api/v1/auth/google; GET callback; GET
  /api/v1/auth/me \|

| Logout \| POST /api/v1/auth/logout \|

| Load sender dropdown \| GET /api/v1/senders \|

| Compose + Schedule \| POST /api/v1/campaigns \|

| Scheduled emails tab \| GET /api/v1/emails?status=scheduled \|

| Sent emails tab \| GET /api/v1/emails?status=sent \|

| Failed emails view \| GET /api/v1/emails?status=failed \|

| Campaign progress \| GET /api/v1/campaigns/:campaignId \|

| Search \| GET /api/v1/search/emails or agreed search route \|

| Connect Slack \| GET /api/v1/integrations/slack/connect \|

| Disconnect Slack \| DELETE /api/v1/integrations/slack \|

## Phase 5 exit criteria

-   Real Google login works end-to-end and user profile appears in
    header.

-   User can select a sender, compose an email, upload recipients, set
    timing/delay/hourly limit, and schedule.

-   Scheduled and sent/failed lists show backend data, not hardcoded
    fixtures.

-   Loading, empty, validation, success, and error states are
    implemented.

-   Frontend does not contain SMTP credentials, OAuth tokens, Redis
    credentials, or database credentials.

-   Full user journey passes against the real backend and survives a
    backend/worker restart.

-   UI matches the provided design closely and is usable on expected
    screen sizes.

# 8. Environment variables and runtime processes

``` text
# App
NODE_ENV=development
PORT=4000
APP_ORIGIN=http://localhost:3000
API_BASE_URL=http://localhost:4000

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/reachinbox

# Redis / BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
QUEUE_PREFIX=reachinbox

# Google OAuth / sessions
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
SESSION_SECRET=
TOKEN_ENCRYPTION_KEY=

# Ethereal SMTP (configure per sender or via local test seed)
ETHEREAL_HOST=
ETHEREAL_PORT=587
ETHEREAL_SECURE=false

# Worker behavior
EMAIL_WORKER_CONCURRENCY=5
DEFAULT_MIN_DELAY_SECONDS=2
DEFAULT_HOURLY_LIMIT=100
MAX_EMAIL_ATTEMPTS=5

# Slack OAuth
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=reachinbox-emails
```

Never commit a real .env file. Keep .env.example free of secrets.
Validate numeric settings and enforce safe upper/lower bounds at
startup.

## Recommended runtime processes

| Process \| Command concept \| Purpose \|

| --- \| --- \| --- \|

| API \| npm run dev:api \| Serves HTTP routes and OAuth callbacks. \|

| Worker \| npm run dev:worker \| Runs BullMQ workers and processors. \|

| Outbox publisher \| npm run dev:outbox \| Publishes committed outbox
  events to queues/indexing. \|

| Reconciler \| npm run dev:reconcile \| Repairs missing queue work from
  durable DB state; no cron. \|

| Infrastructure \| docker compose up -d \| PostgreSQL, Redis,
  Elasticsearch. \|

For local development, these can be separate terminal processes. In
deployment, run them as separate processes/containers with independent
health checks and graceful shutdown.

# 9. Suggested Antigravity working protocol

Use one phase prompt at a time. The prompt should tell the agent to
inspect the existing repository first, implement only the named phase,
preserve prior contracts, run tests, and report changed files and
evidence.

-   Before coding: ask Antigravity to summarize the current repository,
    proposed changes, dependencies, and files it intends to
    create/update.

-   During coding: require small, reviewable steps. Do not allow it to
    replace architecture or rewrite unrelated files without approval.

-   After coding: require a file-by-file summary, commands run, test
    output, unresolved issues, and manual verification steps.

-   Do not accept 'it should work' as evidence. Require actual passing
    tests or reproducible manual steps.

-   Keep an architecture decision log for decisions such as rolling vs
    fixed hourly window, per-sender vs global limit, cancellation
    semantics, and ambiguous SMTP outcomes.

-   Commit after each phase passes. Use separate commits/branches so
    regressions can be traced.

# 10. Copy/paste phase prompts for Antigravity

Use the following as the opening instruction for each phase, then attach
the detailed checklist for that phase from this document.

## Phase 1 prompt

``` text
Implement Phase 1 only: backend foundation, Docker infrastructure, PostgreSQL schema/migrations, Redis connection, Express app/server, config validation, logging/error handling, health endpoints, and backend Google OAuth/session foundation. Do not build frontend, queues, SMTP sending, Slack, or Elasticsearch indexing yet. Inspect the repository first. Follow the Phase 1 tasks and exit criteria in the implementation plan. Run migrations and tests, then report every changed file, commands run, test results, and remaining issues. Do not proceed to Phase 2.
```

## Phase 2 prompt

``` text
Implement Phase 2 only: sender-account APIs, campaign/recipient validation and persistence, idempotent campaign creation, 60-second startAt grace-window behavior, transactional outbox, BullMQ delayed scheduling, scheduling/sending workers, Ethereal SMTP adapter, email status/event tracking, and read/list APIs. Do not build frontend or Phase 3 integrations. Preserve Phase 1 schema/contracts unless you propose a migration and explain why. Run the Phase 2 tests and report evidence. Do not proceed to Phase 3.
```

## Phase 3 prompt

``` text
Implement Phase 3 only: configurable worker concurrency, cross-worker minimum send delay, atomic Redis hourly rate limit, rescheduling at cap, retry classification, graceful shutdown, restart reconciliation, Slack OAuth/live notifications, Elasticsearch indexing/search, and protected Bull Board. Do not build frontend. Prove behavior with multi-worker and failure tests. Report configuration, tests, and trade-offs. Do not proceed to Phase 4.
```

## Phase 4 prompt

``` text
Perform Phase 4 backend verification and hardening only. Do not add frontend features. Build/run automated unit, integration, and end-to-end tests; verify restart persistence, idempotency, 1000+ scheduling behavior, multi-worker rate limiting/delay, Slack live notification, Elasticsearch search, authorization, and dependency outages. Fix defects, produce Postman/Bruno collection and OpenAPI/API contract, update README, and freeze frontend-facing DTOs. Do not proceed to Phase 5 until every exit criterion is evidenced.
```

## Phase 5 prompt

``` text
Implement Phase 5 only: build the React/Next.js TypeScript + Tailwind frontend using the Phase 4 frozen API contract. Implement real Google login, user header/logout, dashboard, compose/upload/recipient count, schedule controls, scheduled and sent/failed tables, loading/empty/error states, and agreed sender/Slack/search screens. Do not change backend contracts silently; if a change is essential, propose it first and update the API contract and tests. Integrate against the real backend and run end-to-end tests.
```

# 11. Submission checklist

-   Private GitHub repository created; grant access to Mitrajit and
    Yadav036 as requested in the assignment.

-   README explains backend, worker, Redis, database, frontend setup,
    Ethereal setup, environment variables, architecture, persistence,
    rate limits, concurrency, and implemented features.

-   Demo video is no longer than 5 minutes.

-   Demo shows campaign creation (frontend or API), Scheduled and Sent
    views, and stop/restart persistence.

-   Where feasible, demonstrate rate limit/delay behavior and live Slack
    notification.

-   Document assumptions, shortcuts, and trade-offs honestly.

-   Submit repository and demo links through the assignment's ClickUp
    submission form.

# 12. Decisions to lock before implementation

| Decision \| Recommended baseline \|

| --- \| --- \|

| Database \| PostgreSQL. \|

| ORM \| Choose Prisma or Drizzle; use migrations; do not mix. \|

| Hourly window \| Use a clearly documented rolling 60-minute window
  unless assignment interpretation requires fixed calendar hour. \|

| Rate-limit scope \| Per sender account, with optional global cap if
  time permits. \|

| Minimum delay scope \| Per sender account across all workers, enforced
  by Redis reservation. \|

| Start time grace \| Accept startAt \>= serverNow - 60 seconds;
  past-but-within-grace becomes immediate; older timestamps rejected. \|

| Duplicate recipient policy \| Deduplicate within one campaign after
  trim + lowercase normalization; return deduplicatedCount. Do not
  deduplicate across separate campaigns. \|

| Job payload \| IDs only; load authoritative data from PostgreSQL. \|

| Search indexing \| Asynchronous via transactional outbox; PostgreSQL
  remains source of truth. \|

| SMTP semantics \| SENT means SMTP accepted the message, not confirmed
  inbox delivery; ambiguous outcomes are not blindly retried. \|

| Bull Board \| Protected; never expose publicly without
  authentication/authorization. \|

These are recommended implementation choices, not all explicit
requirements from the assignment. If you choose differently, record the
reason in the README and keep the behavior consistent across backend,
tests, and frontend.
