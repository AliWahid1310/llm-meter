# LLM Usage Metering & Billing Service

A production-grade backend service that meters LLM usage, enforces subscription quotas, calculates costs with real-world AI-token pricing rules, and integrates Stripe (test mode) for subscription management with signature-verified, idempotent webhooks.

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP
       ▼
┌──────────────────────────────────────────────┐
│           Express Server (:3000)             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          Middleware Layer               │  │
│  │  helmet · cors · validation · errors   │  │
│  └──────────────┬─────────────────────────┘  │
│                 ▼                             │
│  ┌────────────────────────────────────────┐  │
│  │           Route Layer                  │  │
│  │                                        │  │
│  │  POST /api/generate    Billable action │  │
│  │  GET  /api/usage/:id   Usage rollup    │  │
│  │  POST /api/checkout    Stripe session  │  │
│  │  POST /webhooks/stripe Webhook handler │  │
│  │  GET  /api/tenants     List tenants    │  │
│  │  POST /api/tenants     Create tenant   │  │
│  └──────────────┬─────────────────────────┘  │
│                 ▼                             │
│  ┌────────────────────────────────────────┐  │
│  │          Service Layer                 │  │
│  │                                        │  │
│  │  MeterService   → idempotent recording │  │
│  │  QuotaService   → limit enforcement    │  │
│  │  CostService    → token pricing math   │  │
│  │  StripeService  → checkout + webhooks  │  │
│  └──────────────┬─────────────────────────┘  │
│                 ▼                             │
│  ┌────────────────────────────────────────┐  │
│  │        Repository Layer (DAL)          │  │
│  │                                        │  │
│  │  tenantRepo · planRepo · usageRepo    │  │
│  │  subscriptionRepo · webhookEventRepo  │  │
│  └──────────────┬─────────────────────────┘  │
│                 ▼                             │
│  ┌────────────────────────────────────────┐  │
│  │        SQLite Database                 │  │
│  │                                        │  │
│  │  tenants · plans · subscriptions      │  │
│  │  usage_events · webhook_events        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
                    ▲
        Stripe      │  Signed Webhooks
        Test Mode   │
                    │
       ┌────────────┴───────────┐
       │     Stripe API         │
       │  (test mode only)      │
       └────────────────────────┘
```

## Plans & Quotas

| Plan | API Calls / Month | AI Tokens / Month | Price |
|------|-------------------|--------------------|-------|
| Free | 1,000             | 100,000            | $0    |
| Pro  | 50,000            | 5,000,000          | $29/mo |

## AI Token Pricing Rules

| Token Type          | Rate (per 1M tokens) | Rule                              |
|---------------------|----------------------|-----------------------------------|
| Input tokens        | $0.075               | Standard input rate               |
| Cached input tokens | $0.01875             | 75% cheaper than standard input   |
| Output tokens       | $0.30                | Standard output rate              |
| Reasoning tokens    | $0.30                | Billed at output token rate       |

- Token categories **cannot** be simply added together — each is priced separately
- All money stored as **integer micro-dollars** (1 micro-dollar = $0.000001)

## Key Design Decisions

- **Idempotency**: Every billable request requires an `idempotency-key` header. Duplicate keys return the original result without creating a new usage event
- **Quota enforcement**: Checked **before** the action, not after. At the limit → `429`; unpaid/upgrade needed → `402`
- **Money as integers**: All costs stored in micro-dollars (10⁻⁶ dollars) to avoid floating-point errors
- **Stripe as truth**: Payment/subscription truth lives at Stripe; our DB mirrors it through verified webhook events only

## Setup & Run

### Prerequisites
- Node.js 18+
- Stripe CLI (for local webhook testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/AliWahid1310/llm-meter.git
cd llm-meter

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Stripe test keys

# Start the server (runs migrations automatically)
npm start

# Seed demo data
npm run seed
```

### Stripe Webhook Testing

```bash
# In a separate terminal, forward Stripe events to localhost
stripe listen --forward-to localhost:3000/webhooks/stripe

# Copy the webhook signing secret (whsec_...) to your .env

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### Run Tests

```bash
npm test
```

## API Endpoints

### `POST /api/generate` — Billable Action
Creates a usage event (simulated AI generation).

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-123" \
  -d '{
    "tenantId": "tenant-1",
    "inputTokens": 1000,
    "cachedInputTokens": 500,
    "outputTokens": 200,
    "reasoningTokens": 50
  }'
```

### `GET /api/usage/:tenantId` — Usage Rollup
Returns current usage, limits, and costs for a tenant.

```bash
curl http://localhost:3000/api/usage/tenant-1
```

### `POST /api/checkout` — Stripe Checkout Session
Creates a Stripe Checkout session for upgrading to Pro.

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{ "tenantId": "tenant-1" }'
```

### `POST /webhooks/stripe` — Stripe Webhook Handler
Receives and processes verified Stripe webhook events.

### `GET /api/tenants` — List Tenants
### `POST /api/tenants` — Create Tenant

## Limitations

- **Test mode only** — no real payments are processed
- **SQLite** — suitable for development; a production system would use PostgreSQL
- **AI tokens are simulated** — no actual LLM calls are made; token counts are provided in the request
- **No invoicing or proration** in core (available as stretch goals)
- **Single-instance** — no horizontal scaling or distributed locking (idempotency is enforced via SQLite's UNIQUE constraint)
