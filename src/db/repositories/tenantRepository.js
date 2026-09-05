/**
 * Tenant Repository — data access for customer organizations.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

/**
 * Get all tenants with their plan details.
 */
function findAll() {
    const db = getDb();
    return db.prepare(`
        SELECT t.*, p.name AS plan_name, p.display_name AS plan_display_name,
               p.api_call_limit, p.ai_token_limit
        FROM tenants t
        JOIN plans p ON t.plan_id = p.id
        ORDER BY t.created_at DESC
    `).all();
}

/**
 * Find a tenant by ID with plan details.
 */
function findById(tenantId) {
    const db = getDb();
    return db.prepare(`
        SELECT t.*, p.name AS plan_name, p.display_name AS plan_display_name,
               p.api_call_limit, p.ai_token_limit
        FROM tenants t
        JOIN plans p ON t.plan_id = p.id
        WHERE t.id = ?
    `).get(tenantId);
}

/**
 * Find a tenant by Stripe customer ID.
 */
function findByStripeCustomerId(stripeCustomerId) {
    const db = getDb();
    return db.prepare(`
        SELECT t.*, p.name AS plan_name, p.display_name AS plan_display_name,
               p.api_call_limit, p.ai_token_limit
        FROM tenants t
        JOIN plans p ON t.plan_id = p.id
        WHERE t.stripe_customer_id = ?
    `).get(stripeCustomerId);
}

/**
 * Create a new tenant.
 */
function create({ name, email, planId }) {
    const db = getDb();
    const id = uuidv4();
    const defaultPlanId = planId || 'free';

    db.prepare(`
        INSERT INTO tenants (id, name, email, plan_id)
        VALUES (?, ?, ?, ?)
    `).run(id, name, email || null, defaultPlanId);

    return findById(id);
}

/**
 * Update a tenant's plan.
 */
function updatePlan(tenantId, planId) {
    const db = getDb();
    db.prepare(`
        UPDATE tenants 
        SET plan_id = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(planId, tenantId);

    return findById(tenantId);
}

/**
 * Update a tenant's Stripe customer ID.
 */
function updateStripeCustomerId(tenantId, stripeCustomerId) {
    const db = getDb();
    db.prepare(`
        UPDATE tenants 
        SET stripe_customer_id = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(stripeCustomerId, tenantId);

    return findById(tenantId);
}

/**
 * Update tenant status.
 */
function updateStatus(tenantId, status) {
    const db = getDb();
    db.prepare(`
        UPDATE tenants 
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(status, tenantId);

    return findById(tenantId);
}

module.exports = {
    findAll,
    findById,
    findByStripeCustomerId,
    create,
    updatePlan,
    updateStripeCustomerId,
    updateStatus,
};
