# RLS Phase 2 — Design Note (prepared 2026-10-26)

Phase 1 is live: policies + `teambee_app` role exist and are probe-verified.
The app still connects as the owner (BYPASSRLS), so nothing is enforced
yet. Phase 2 = teach the code to carry the tenant context; Phase 3 =
cut `DATABASE_URL` over to `teambee_app`. **Do not do Phase 3 first —
pre-auth flows would see zero rows and login/webhooks would break.**

## The mechanical constraint

Neon's pooled endpoint uses transaction-mode pooling: a connection is
leased per transaction, so a session-level `SET app.tenant_id` can bleed
into the next request that reuses the connection (a leak WORSE than no
RLS). Only `set_config('app.tenant_id', X, true)` (transaction-local)
inside an explicit transaction is sound on this stack. Any design that
relies on session state or per-connection hooks is rejected.

## Call-site census (2026-10-26)

154 Prisma call sites across ~20 files, in four flow classes:

1. **Tenant-known API calls (the bulk)** — chats, messages, agents,
   templates, broadcasts, quick replies, analytics. `req.tenantId` is
   available from the auth middleware.
2. **Pre-auth flows** — login (`agents` by email), workspace lookup
   (tenants by slug, agents by email), register-tenant (INSERTs a tenant
   that has no context yet), forgot-password (agents by email).
3. **Webhook ingress** — tenant resolution by `phone_number_id`, then
   tenant-known processing per event (webhookParserService).
4. **System scans** — maintenance drains (broadcasts/webhooks/snooze
   across ALL tenants by design), automation engine, audit writes.

## Options considered

- **A. Prisma `$extends` query hook per tenant** — the hook cannot run
  the intercepted operation inside its own transaction on the pooled
  endpoint. Unreliable here. Rejected.
- **B. Explicit `withTenantDb(tenantId, tx => …)` helper** — interactive
  transaction + `set_config(..., true)` first statement; adopt on the
  highest-risk surfaces first (chat/message reads), expand in passes.
  Mechanically sound; coverage grows incrementally.
- **C. Direct (non-pooled) endpoint + session context** — Prisma exposes
  no per-connection checkout/reset hook; context bleed risk. Rejected.
- **D. A database-visible "system" context for class 2–4 flows** — extra
  permissive policies keyed on `app.tenant_id = '__system__'`, used ONLY
  by the enumerated pre-auth/system flows. Weaker than per-tenant binding
  for those few flows (any app-role connection could claim it), but the
  privilege is explicit in `pg_policies` and auditable, and tenant-known
  traffic (class 1) stays hard-bound.

## Recommendation

**B + D.** Ship B behind `RLS_TENANT_CONTEXT=true` (default off, so the
deploy is behaviour-identical until enabled), verify on the owner
connection with the probe function (context present + correct), then a
staging pass AS `teambee_app`, then Phase 3: set a password on
`teambee_app`, point Render's `DATABASE_URL` at it, keep the owner URL
documented for one-command rollback.

Estimated effort: one focused round for B on the top surfaces + D
policies + staging verification; a second pass for the long tail.
