/**
 * Webhook Event Repository — tracks processed Stripe events for deduplication.
 * 
 * Prevents the same Stripe event from being processed more than once,
 * even if Stripe retries delivery or the event is replayed.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

/**
 * Check if a Stripe event has already been processed.
 */
function isProcessed(stripeEventId) {
    const db = getDb();
    const result = db.prepare(
        'SELECT id FROM webhook_events WHERE stripe_event_id = ?'
    ).get(stripeEventId);

    return !!result;
}

/**
 * Mark a Stripe event as processed.
 * Returns true if newly marked, false if already existed.
 */
function markProcessed(stripeEventId, eventType) {
    const db = getDb();
    const id = uuidv4();

    try {
        db.prepare(`
            INSERT INTO webhook_events (id, stripe_event_id, event_type)
            VALUES (?, ?, ?)
        `).run(id, stripeEventId, eventType);
        return true;
    } catch (err) {
        // Already processed — UNIQUE constraint on stripe_event_id
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
            return false;
        }
        throw err;
    }
}

module.exports = { isProcessed, markProcessed };
