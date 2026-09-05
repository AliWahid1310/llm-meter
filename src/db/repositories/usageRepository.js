/**
 * Usage Event Repository — data access for billable usage events.
 * 
 * The idempotency_key UNIQUE constraint is the core mechanism that
 * prevents double-counting. If a duplicate key is inserted, SQLite
 * rejects it, and we return the existing event instead.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

/**
 * Get the current billing period in YYYY-MM format.
 */
function getCurrentBillingPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Record a usage event with idempotency.
 * 
 * Returns { created: true, event } for new events.
 * Returns { created: false, event } for duplicate idempotency keys.
 * 
 * This is the HEART of the metering system's correctness guarantee.
 */
function record({ tenantId, type, quantity, tokenType, idempotencyKey, metadata }) {
    const db = getDb();
    const billingPeriod = getCurrentBillingPeriod();

    // First, check if an event with this idempotency key already exists
    const existing = db.prepare(
        'SELECT * FROM usage_events WHERE idempotency_key = ?'
    ).get(idempotencyKey);

    if (existing) {
        // Duplicate — return the original event, do NOT create a new one
        return { created: false, event: existing };
    }

    // New event — insert it
    const id = uuidv4();
    try {
        db.prepare(`
            INSERT INTO usage_events (id, tenant_id, type, quantity, token_type, 
                idempotency_key, billing_period, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            tenantId,
            type,
            quantity,
            tokenType || null,
            idempotencyKey,
            billingPeriod,
            metadata ? JSON.stringify(metadata) : null
        );

        const event = db.prepare('SELECT * FROM usage_events WHERE id = ?').get(id);
        return { created: true, event };
    } catch (err) {
        // Handle race condition: another request inserted with the same key
        // between our SELECT and INSERT. This is the safety net.
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
            const existing = db.prepare(
                'SELECT * FROM usage_events WHERE idempotency_key = ?'
            ).get(idempotencyKey);
            return { created: false, event: existing };
        }
        throw err;
    }
}

/**
 * Get usage summary for a tenant in the current billing period.
 * Returns total API calls and token breakdown.
 */
function getUsageSummary(tenantId, billingPeriod) {
    const db = getDb();
    const period = billingPeriod || getCurrentBillingPeriod();

    // Get total API calls
    const apiCalls = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM usage_events
        WHERE tenant_id = ? AND type = 'api_call' AND billing_period = ?
    `).get(tenantId, period);

    // Get total AI tokens (all types combined for quota check)
    const totalTokens = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM usage_events
        WHERE tenant_id = ? AND type = 'ai_tokens' AND billing_period = ?
    `).get(tenantId, period);

    // Get token breakdown by type for cost calculation
    const tokenBreakdown = db.prepare(`
        SELECT token_type, COALESCE(SUM(quantity), 0) AS total
        FROM usage_events
        WHERE tenant_id = ? AND type = 'ai_tokens' AND billing_period = ?
        GROUP BY token_type
    `).all(tenantId, period);

    const breakdown = {
        input: 0,
        cached_input: 0,
        output: 0,
        reasoning: 0,
    };

    for (const row of tokenBreakdown) {
        if (row.token_type && breakdown.hasOwnProperty(row.token_type)) {
            breakdown[row.token_type] = row.total;
        }
    }

    return {
        billingPeriod: period,
        apiCalls: apiCalls.total,
        totalTokens: totalTokens.total,
        tokenBreakdown: breakdown,
    };
}

/**
 * Get all usage events for a tenant in a billing period.
 */
function findByTenantAndPeriod(tenantId, billingPeriod) {
    const db = getDb();
    const period = billingPeriod || getCurrentBillingPeriod();

    return db.prepare(`
        SELECT * FROM usage_events
        WHERE tenant_id = ? AND billing_period = ?
        ORDER BY created_at DESC
    `).all(tenantId, period);
}

/**
 * Count events for a specific type (used in quota checks).
 */
function countByType(tenantId, type, billingPeriod) {
    const db = getDb();
    const period = billingPeriod || getCurrentBillingPeriod();

    const result = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM usage_events
        WHERE tenant_id = ? AND type = ? AND billing_period = ?
    `).get(tenantId, type, period);

    return result.total;
}

module.exports = {
    getCurrentBillingPeriod,
    record,
    getUsageSummary,
    findByTenantAndPeriod,
    countByType,
};
