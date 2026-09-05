-- ============================================================
-- LLM Usage Metering & Billing Service — Initial Schema
-- ============================================================

-- Plans table: defines subscription tiers and their quotas
CREATE TABLE IF NOT EXISTS plans (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    api_call_limit  INTEGER NOT NULL,       -- monthly API call quota
    ai_token_limit  INTEGER NOT NULL,       -- monthly AI token quota
    price_cents     INTEGER NOT NULL DEFAULT 0,  -- monthly price in cents
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tenants table: customer organizations
CREATE TABLE IF NOT EXISTS tenants (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT,
    plan_id         TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    status          TEXT NOT NULL DEFAULT 'active',  -- active, suspended
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- Subscriptions table: tracks Stripe subscription state
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    plan_id             TEXT NOT NULL,
    stripe_subscription_id TEXT,
    stripe_customer_id  TEXT,
    status              TEXT NOT NULL DEFAULT 'active',  -- active, canceled, past_due
    current_period_start TEXT,
    current_period_end   TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- Usage events table: every billable action recorded here
-- The idempotency_key UNIQUE constraint is the heart of duplicate prevention
CREATE TABLE IF NOT EXISTS usage_events (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    type            TEXT NOT NULL,           -- 'api_call' or 'ai_tokens'
    quantity        INTEGER NOT NULL,        -- count of API calls or tokens
    token_type      TEXT,                    -- 'input', 'cached_input', 'output', 'reasoning' (null for api_call)
    idempotency_key TEXT NOT NULL UNIQUE,    -- prevents double-counting
    billing_period  TEXT NOT NULL,           -- YYYY-MM format for monthly rollup
    metadata        TEXT,                    -- JSON string for extra context
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Webhook events table: tracks processed Stripe events for deduplication
CREATE TABLE IF NOT EXISTS webhook_events (
    id              TEXT PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,    -- Stripe's event ID — prevents duplicate processing
    event_type      TEXT NOT NULL,           -- e.g., 'checkout.session.completed'
    processed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Indexes for query performance
-- ============================================================

-- Fast tenant usage lookups by period
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_period 
    ON usage_events(tenant_id, billing_period);

-- Fast usage rollup by type within a tenant's billing period
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_type_period 
    ON usage_events(tenant_id, type, billing_period);

-- Fast idempotency key lookups (UNIQUE already creates an index, but being explicit)
CREATE INDEX IF NOT EXISTS idx_usage_events_idempotency 
    ON usage_events(idempotency_key);

-- Fast subscription lookups by tenant
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant 
    ON subscriptions(tenant_id);

-- Fast webhook event deduplication lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id 
    ON webhook_events(stripe_event_id);

-- Fast tenant lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer 
    ON tenants(stripe_customer_id);
