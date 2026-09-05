/**
 * Plan Repository — data access for subscription plans.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

/**
 * Get all plans.
 */
function findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM plans ORDER BY price_cents ASC').all();
}

/**
 * Find a plan by ID.
 */
function findById(planId) {
    const db = getDb();
    return db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
}

/**
 * Find a plan by name (e.g., 'free', 'pro').
 */
function findByName(name) {
    const db = getDb();
    return db.prepare('SELECT * FROM plans WHERE name = ?').get(name);
}

/**
 * Create or update a plan (upsert).
 * Used during seeding.
 */
function upsert({ id, name, displayName, apiCallLimit, aiTokenLimit, priceCents }) {
    const db = getDb();
    const planId = id || uuidv4();

    const stmt = db.prepare(`
        INSERT INTO plans (id, name, display_name, api_call_limit, ai_token_limit, price_cents)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            display_name = excluded.display_name,
            api_call_limit = excluded.api_call_limit,
            ai_token_limit = excluded.ai_token_limit,
            price_cents = excluded.price_cents
    `);

    stmt.run(planId, name, displayName, apiCallLimit, aiTokenLimit, priceCents);
    return findById(planId);
}

module.exports = { findAll, findById, findByName, upsert };
