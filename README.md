# ChatFlow • B2B Multi-Agent WhatsApp Shared Team Inbox SaaS

A production-grade, high-performance WhatsApp Shared Inbox SaaS tailored for Indian SMBs, coaching institutes, D2C brands, clinics, and real estate agencies to manage customer operations via a single official WhatsApp Business number.

---

## 🏗️ Core Architecture & Tech Stack

- **Backend API & Meta Webhooks**: Node.js, Express, Axios
- **Real-Time Duplex Streaming**: Socket.io (with JWT handshake auth & tenant/chat-scoped RBAC rooms)
- **Database & Schemas**: Prisma ORM with strict Foreign Key constraints, cascading deletes, composite indices, SQLite for instant zero-dependency local runtime & ready-to-deploy PostgreSQL DDL migration scripts (`server/prisma/migrations/001_initial_schema.sql`)
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
- **Payload Ingestion**: `POST /webhook` responding `200 OK` in < 200ms to adhere to Meta's SLA.
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

### 3. Pre-Seeded Demo Credentials
| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Tenant Admin** | `rahul.verma@apexeducare.in` | `Admin@123` | Complete visibility, agent management, re-routing, Meta settings |
| **Senior Counsellor** | `priya.sharma@apexeducare.in` | `Agent@123` | Assigned chats + Unassigned pool |
| **Admissions Desk** | `amit.singh@apexeducare.in` | `Agent@123` | Assigned chats + Unassigned pool |
