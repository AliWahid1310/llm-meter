# EVIDENCE.md — Proof of Requirements

Each section below contains pasted proof that the corresponding requirement from Section 6 of the capstone brief is met.

---

## 1. Metering — Idempotent Usage Recording

**Requirement**: A billable action creates exactly one usage event, even under retries — deduplicated by idempotency key.

### Probe 1: Same request sent twice with one idempotency key → exactly one usage event

```
[Test output will be pasted here after running tests]
```

---

## 2. Quotas — Boundary Enforcement

**Requirement**: Usage is checked against the tenant's plan; requests over the limit are rejected with correct status codes (429/402).

### Probe 2: Drive tenant to exact quota → boundary behavior correct → next request returns 429/402

```
[Test output will be pasted here after running tests]
```

---

## 3. Cost Calculation — AI Token Pricing

**Requirement**: Monthly usage rolls up into a cost figure per tenant. AI token pricing handles cached input tokens, reasoning tokens, and output pricing correctly.

### Probe 5: Pinned pricing rules produce exact expected totals

```
[Test output will be pasted here after running tests]
```

### Pricing Constants (pinned in `src/config/pricing.js`)

| Token Type          | Rate (per 1M tokens) | Micro-dollars per token |
|---------------------|----------------------|------------------------|
| Input tokens        | $0.075               | 75 micro-$ / 1M        |
| Cached input tokens | $0.01875             | 18.75 micro-$ / 1M     |
| Output tokens       | $0.30                | 300 micro-$ / 1M       |
| Reasoning tokens    | $0.30 (= output)     | 300 micro-$ / 1M       |

---

## 4. Stripe Integration — Checkout & Webhooks

**Requirement**: Subscription checkout works end-to-end in Stripe test mode. Webhooks verify signatures, ignore duplicate events, and update tenant plan/status.

### Probe 3: Stripe test Checkout → webhook flips tenant Free → Pro

```
[Test output will be pasted here after running tests]
```

### Probe 4: Forged webhook → 400, nothing changes. Replay → processed once

```
[Test output will be pasted here after running tests]
```

---

## 5. Data Model & Documentation

**Requirement**: Database includes tenants, plans, subscriptions, and usage events; customer data isolated per tenant. README + architecture diagram + setup instructions present.

### Database Schema

```sql
-- See src/db/migrations/001_initial.sql for full DDL
-- Tables: plans, tenants, subscriptions, usage_events, webhook_events
-- Tenant isolation enforced via tenant_id foreign keys on all data tables
```

### Required Files Present

- [x] README.md — architecture diagram, setup, limitations
- [x] capstone.yaml — run/seed/test commands
- [x] EVIDENCE.md — this file
- [x] BUILDLOG.md — AI usage log
- [x] .env.example — all env vars with placeholders
