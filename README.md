# ChatFlow • B2B Multi-Agent WhatsApp Shared Team Inbox SaaS

A production-grade, high-performance WhatsApp Shared Inbox SaaS tailored for Indian SMBs, coaching institutes, D2C brands, clinics, and real estate agencies to manage customer operations via a single official WhatsApp Business number.

---

## 🏗️ Core Architecture & Tech Stack

- **Backend API & Meta Webhooks**: Node.js, Express, Axios
- **Real-Time Duplex Streaming**: Socket.io (with JWT handshake auth & tenant/chat-scoped RBAC rooms)
- **Database & Schemas**: Prisma ORM with PostgreSQL, strict foreign-key constraints, cascading deletes, composite indices, durable webhook inbox events, idempotent message keys, and checked-in migrations under `server/prisma/migrations/`
- **Frontend Dashboard**: React (Vite), Lucide Icons, responsive 3-column layout matching WhatsApp Web / Intercom / Crisp
- **Meta Integration**: Meta Cloud API (v20.0), Permanent System User Access Token support, Webhook verification handshake, and resilient sandbox fallback

---

## 🎯 Implemented Technical Deliverables

### 1. Database Schema & Migrations
- **Tenants (Businesses)**: Multi-tenant credentials storage (`waba_id`, `phone_number_id`, `access_token`, `webhook_verify_token`, `display_phone_number`).
- **Agents (Staff)**: Role-Based Access Control (`ADMIN`, `AGENT`, `SUPERVISOR`) with active presence status (`ONLINE`, `BUSY`, `OFFLINE`).
- **Contacts (Customers)**: Phone numbers with international country code (`+91`), custom CRM attributes (lead stage, target program, city).
- **Chats (Sessions)**: Dynamic lifecycle state machine (`UNASSIGNED` -> `OPEN` -> `RESOLVED`), unread counters, assigned agent foreign keys, and tags.
- **Messages (Logs)**: Inbound & outbound transcripts, Meta unique message IDs (`wamid.HBgL...`) for deduplication, message types (`TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT`, `LOCATION`, `INTERACTIVE`, `TEMPLATE`), and delivery statuses (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
- **Templates & Broadcasts**: Approved Meta template definitions, dynamic variable replacements (`{{1}}`, `{{2}}`), and campaign delivery analytics.

### 2. Hardened Webhook Parser Engine
- **Verification Handshake**: `GET /webhook` compliant with Meta's `hub.mode === 'subscribe'` and `hub.verify_token` challenge.
- **Payload Ingestion**: `POST /webhook` validates the raw-body HMAC, durably records the event, then responds `200 OK`; processing is asynchronous and restart-recoverable.
- **Idempotency & Deduplication**: Checks `wa_message_id` before inserting; prevents duplicate records on Meta webhook retries.
- **Multi-Message Type Parsing**: Extracts texts, images, audio, documents, interactive button clicks, and locations.
- **Delivery Status Updates**: Maps Meta status callbacks (`sent`, `delivered`, `read`, `failed`) and broadcasts checkmark transitions to connected agents via WebSockets.

### 3. Complex Socket.io Custom Middleware & Room Isolation
- **JWT Authentication Handshake**: Token verified in connection middleware against database; active status validated.
- **Tenant Isolation**: Every socket joins `tenant:{tenantId}` for global notifications.
- **Personal Room**: Sockets join `agent:{agentId}` for direct assignment alerts.
- **RBAC Room Join Guard**:
  - `ADMIN` / `SUPERVISOR`: Omniscient visibility to join any conversation room.
  - `AGENT`: Can strictly ONLY join `chat:{chatId}` if assigned to them or if currently `UNASSIGNED`. Unauthorized joins are rejected.

### 4. 3-Column Responsive Frontend Architecture
- **Column 1 (Navigation & Conversation List)**:
  - Role-based tabs: `Mine`, `Unassigned`, `All (Admin View)`
  - Status filters: `OPEN`, `UNASSIGNED`, `RESOLVED`, `ALL`
  - Real-time search by customer name or phone number
  - Unread badge counters, WhatsApp initials avatar, and assigned staff chips.
- **Column 2 (Active Chat Canvas)**:
  - Customer verified header with agent reassignment dropdown and "Claim Chat" button
  - Lifecycle state pill (`UNASSIGNED`, `OPEN`, `RESOLVED`) and "Resolve / Reopen" toggle
  - Inbound & outbound message bubbles with delivery tick marks (clock -> single check -> double check -> double blue check)
  - 24-Hour WhatsApp Customer Care Window notice with live countdown and template re-engagement reminder
  - Canned quick replies (`/fees`, `/demo`, `/location`) and interactive composer.
- **Column 3 (Contact & CRM Sidebar)**:
  - Customer phone card with direct `wa.me` WhatsApp Web link
  - Lead stage, target exam/course, city, and institution
  - Dynamic tag manager (Add / remove tags like "Urgent", "Fee Enquiry", "High Intent")
  - Approved WhatsApp Template quick launcher
  - Operational SLA audit trail.
- **Consoles & Modals**:
  - **Meta Onboarding Console**: Update System User Permanent Access Token, WABA ID, Phone Number ID, and Copy Webhook URL.
  - **Template Picker Modal**: Choose approved template, map variables (`{{1}}`, `{{2}}`), and view live WhatsApp bubble preview.
  - **Staff Management Console**: Admin roster view, staff response speeds, and create agent accounts.
  - **Live Webhook Test Simulator**: Interactive panel to fire authentic Meta WhatsApp inbound payloads and delivery callbacks without external tunnels.

---

## Reproducible setup

The repository pins Node.js to **22.19.0** in `.nvmrc`. Use that runtime (or the
same `node:22.19.0-bookworm-slim` image used by the Dockerfile) for consistent
dependency installation and builds.

### Prerequisites

- Node.js 22.19.0 and npm 10+
- PostgreSQL 14+ for the API and seed data (the Prisma schema uses PostgreSQL)
- Redis 6+ when running more than one API replica (Socket.io fanout)
- Docker Engine 24+ only when using the container workflow

### Local setup

```bash
nvm install
nvm use
cp server/.env.example server/.env
# Edit server/.env and set DATABASE_URL, private JWT_SECRET and
# CREDENTIAL_ENCRYPTION_KEY values, and Meta webhook secrets.
# Set SEED_ADMIN_PASSWORD and SEED_AGENT_PASSWORD before running the local seed.
npm ci --prefix server
npm ci --prefix client
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate:deploy
npm run seed
```

`server/.env.example` contains placeholders only. Keep `server/.env` local and
provide real Meta credentials through the environment of the deployment.
`prisma:migrate:deploy` applies the checked-in SQL migrations in order. Do not
use `prisma db push` against production because it bypasses migration history.
The demo seed is destructive and is disabled when `NODE_ENV=production`.

If a PostgreSQL database was created by an older ChatFlow release with
`prisma db push` and has no `_prisma_migrations` history, take a backup, mark
the initial migration as already applied, and then deploy the hardening
migration:

```bash
npm --prefix server exec prisma migrate resolve --applied 202610190001_initial_schema
npm --prefix server run prisma:migrate:deploy
```

Only use that baseline command after verifying the existing tables match the
initial schema; a clean database should run `prisma:migrate:deploy` directly.

### Run locally

Start the API and frontend in separate terminals:

```bash
npm run dev:server   # http://localhost:5000
npm run dev:client   # http://localhost:3000
```

For a production-style API process, use `npm run start:server`. The Vite
development proxy forwards `/api`, `/webhook`, and `/socket.io` to port 5000.
The API also serves `client/dist` when the production bundle is present.

### Tests and build

The single repository test command is:

```bash
npm test
```

The webhook tests use an in-memory Prisma-shaped fixture. They cover signature
verification, inbound parsing, contact/chat creation, WAMID deduplication, and
delivery status transitions without contacting PostgreSQL, Meta, or the
internet. `npm run test:server` is retained as an equivalent server-level
alias. `npm run build` verifies the production client bundle.

Build the browser bundle with:

```bash
npm run build
```

The output is written to `client/dist/` and can be deployed to a static host.
Set `VITE_API_URL` at build time when the API is hosted on another origin.

### Docker deployment

The multi-stage `Dockerfile` installs locked dependencies, generates the Prisma
client, builds the Vite frontend, and produces a runtime image whose default
process is the API server. The built frontend is included at
`/app/client/dist` for static-host extraction or a separate static deployment.

```bash
docker build --build-arg VITE_API_URL=http://localhost:5000 -t chatflow:local .
docker run --rm --name chatflow-api \
  --env-file server/.env \
  -p 5000:5000 \
  chatflow:local
```

Before starting a new deployment, initialize the target PostgreSQL schema from
an environment with database access:

```bash
npm ci --prefix server
npm --prefix server run prisma:migrate:deploy
```

Then provide `DATABASE_URL`, `JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `CLIENT_URL`/`CORS_ORIGINS`,
`META_APP_SECRET`, `META_ALLOW_MOCK=false`, and the required Meta variables
with the platform's secret manager or environment configuration. Do not bake
`server/.env` into an image. Check both `GET /health` and `GET /ready` after
the container starts.

### Production release checklist

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Generate random `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` values of at
   least 32 characters each.
3. Set `META_ALLOW_MOCK=false` and configure the Meta access token, WABA ID,
   phone-number ID, webhook verification token, and app secret. The app secret
   is required for `X-Hub-Signature-256` validation.
4. Set `CORS_ORIGINS` to the exact HTTPS frontend origin(s); do not use `*`.
   Use `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true` only when the frontend
   and API are on different HTTPS sites.
5. Apply migrations with `npm --prefix server run prisma:migrate:deploy`.
   For a database created by the legacy standalone SQL file, take a backup,
   verify the existing tables match the original schema, then baseline the
   checked-in initial migration once with
   `npm --prefix server exec prisma migrate resolve --applied 202610190001_initial_schema`
   before running `prisma:migrate:deploy`. Never mark a migration applied
   without reviewing the live schema first.
6. Configure Meta's callback URL as `https://your-api.example.com/webhook`.
7. Deploy the API and frontend bundle, then verify `/health`, `/ready`, login,
   an inbound webhook, an outbound message, and a delivery-status callback.
8. Set `REDIS_URL` before running multiple API replicas. Socket.io uses the
   Redis adapter when configured; use a shared rate-limit store as well because
   the included in-memory limiter is safe for one replica only.

## ⚡ Quickstart Guide

### 1. Start Backend Server
```bash
npm run start:server
# Listening on http://localhost:5000
```

### 2. Start Frontend Dev Dashboard
```bash
npm run dev:client
# Ready on http://localhost:3000
```

### 3. Local demo credentials

The non-production seed creates the demo accounts with passwords supplied
through `SEED_ADMIN_PASSWORD` and `SEED_AGENT_PASSWORD`. Never commit those
values or reuse them in a deployed environment.
