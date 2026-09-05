# BUILDLOG.md — AI Usage Log

This document tracks where AI tools were used during development, what they got right, what they got wrong, and what I changed.

## Phase 1 — Project Scaffold & Design

| Task | AI Involvement | Notes |
|------|---------------|-------|
| `.gitignore` | AI generated initial template | Reviewed and approved — standard Node.js patterns |
| `package.json` | AI generated with dependency list | Verified dependency versions are current |
| `README.md` | AI drafted architecture diagram and docs | Reviewed architecture accuracy, edited plan details |
| `.env.example` | AI generated placeholder template | Added comments for clarity |
| Database schema | AI proposed initial schema design | Reviewed foreign keys, indexes, and naming conventions |

## Phase 2 — Database & Data Layer

| Task | AI Involvement | Notes |
|------|---------------|-------|
| Migration SQL | AI generated DDL statements | Verified UNIQUE constraints on idempotency_key |
| Repository layer | AI generated CRUD operations | Reviewed query correctness, added parameterized queries |
| Seed script | AI generated demo data | Adjusted tenant/plan values for realism |

## Phase 3 — Core Billing Logic

| Task | AI Involvement | Notes |
|------|---------------|-------|
| MeterService | AI implemented idempotency logic | Verified duplicate detection works via UNIQUE constraint |
| QuotaService | AI implemented boundary checking | Manually tested edge cases at exact quota limits |
| CostService | AI implemented token pricing | Verified math against pinned pricing constants by hand |

## Phase 4 — API Routes

| Task | AI Involvement | Notes |
|------|---------------|-------|
| Route handlers | AI generated Express routes | Added input validation, reviewed error responses |
| Error handling | AI generated middleware | Ensured 4xx for bad input, never 500 |
| Validation | AI generated input checks | Added boundary checks for numeric fields |

## Phase 5 — Stripe Integration

| Task | AI Involvement | Notes |
|------|---------------|-------|
| Checkout flow | AI generated Stripe session creation | Tested with Stripe CLI, verified redirect URLs |
| Webhook handler | AI generated signature verification | Tested with forged payloads — correctly rejected |
| Event deduplication | AI generated webhook_events table logic | Verified duplicate events are ignored |

## Phase 6 — Background Jobs

| Task | AI Involvement | Notes |
|------|---------------|-------|
| Usage alert job | AI generated periodic check | Verified threshold calculations at 80% and 100% |

## Phase 7 — Testing

| Task | AI Involvement | Notes |
|------|---------------|-------|
| Test script | AI generated acceptance probes | Ran all 5 probes, verified outputs match expectations |

## Honesty Note

AI tools were used extensively for code generation throughout this project. Every generated piece was:
1. **Read and understood** before committing
2. **Tested** against the acceptance probes
3. **Modified** where the AI's output didn't match requirements (especially edge cases in quota enforcement and token pricing math)

The most common AI error was in token pricing calculation — initial implementations tried to add all token types together before pricing, which violates the rule that categories must be priced separately. This was caught during manual verification and fixed.
