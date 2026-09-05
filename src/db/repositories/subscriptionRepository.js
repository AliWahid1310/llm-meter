/**
 * Subscription Repository — data access for Stripe subscriptions.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

/**
 * Find subscription by tenant ID.
 */
function findByTenantId(tenantId) {
    const db = getDb();
    return db.prepare(`
        SELECT s.*, p.name AS plan_name, p.display_name AS plan_display_name
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = ?
        ORDER BY s.created_at DESC
        LIMIT 1
    `).get(tenantId);
}

/**
 * Find subscription by Stripe subscription ID.
 */
function findByStripeSubscriptionId(stripeSubscriptionId) {
    const db = getDb();
    return db.prepare(`
        SELECT s.*, p.name AS plan_name, p.display_name AS plan_display_name
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.stripe_subscription_id = ?
    `).get(stripeSubscriptionId);
}

/**
 * Create a new subscription.
 */
function create({
    tenantId,
    planId,
    stripeSubscriptionId,
    stripeCustomerId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
}) {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
        INSERT INTO subscriptions (id, tenant_id, plan_id, stripe_subscription_id, 
            stripe_customer_id, status, current_period_start, current_period_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        tenantId,
        planId,
        stripeSubscriptionId || null,
        stripeCustomerId || null,
        status || 'active',
        currentPeriodStart || null,
        currentPeriodEnd || null
    );

    return findByTenantId(tenantId);
}

/**
 * Update subscription status and period.
 */
function update(stripeSubscriptionId, { status, planId, currentPeriodStart, currentPeriodEnd }) {
    const db = getDb();
    db.prepare(`
        UPDATE subscriptions 
        SET status = COALESCE(?, status),
            plan_id = COALESCE(?, plan_id),
            current_period_start = COALESCE(?, current_period_start),
            current_period_end = COALESCE(?, current_period_end),
            updated_at = datetime('now')
        WHERE stripe_subscription_id = ?
    `).run(
        status || null,
        planId || null,
        currentPeriodStart || null,
        currentPeriodEnd || null,
        stripeSubscriptionId
    );

    return findByStripeSubscriptionId(stripeSubscriptionId);
}

/**
 * Cancel a subscription (set status to canceled).
 */
function cancel(stripeSubscriptionId) {
    return update(stripeSubscriptionId, { status: 'canceled' });
}

module.exports = {
    findByTenantId,
    findByStripeSubscriptionId,
    create,
    update,
    cancel,
};
