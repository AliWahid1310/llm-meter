/**
 * Meter Service — idempotent usage event recording.
 * 
 * This is the HEART of the billing system's correctness guarantee.
 * The same request + same idempotency key = exactly one usage event.
 * Retries must NEVER create duplicate charges.
 */

const usageRepository = require('../db/repositories/usageRepository');

/**
 * Record a usage event with idempotency guarantee.
 * 
 * @param {string} tenantId - The tenant's ID
 * @param {string} type - 'api_call' or 'ai_tokens'
 * @param {number} quantity - Number of calls or tokens
 * @param {string} idempotencyKey - Unique key for deduplication
 * @param {string} [tokenType] - 'input', 'cached_input', 'output', 'reasoning'
 * @param {object} [metadata] - Optional extra context
 * 
 * @returns {{ created: boolean, event: object }}
 *   - created=true: new event recorded
 *   - created=false: duplicate key, original event returned (no new charge)
 */
function record(tenantId, type, quantity, idempotencyKey, tokenType = null, metadata = null) {
    if (!tenantId) throw new Error('tenantId is required');
    if (!type || !['api_call', 'ai_tokens'].includes(type)) {
        throw new Error('type must be "api_call" or "ai_tokens"');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('quantity must be a positive integer');
    }
    if (!idempotencyKey) throw new Error('idempotencyKey is required');

    if (type === 'ai_tokens') {
        const validTokenTypes = ['input', 'cached_input', 'output', 'reasoning'];
        if (!tokenType || !validTokenTypes.includes(tokenType)) {
            throw new Error(`tokenType must be one of: ${validTokenTypes.join(', ')}`);
        }
    }

    const result = usageRepository.record({
        tenantId,
        type,
        quantity,
        tokenType,
        idempotencyKey,
        metadata,
    });

    if (result.created) {
        console.log(`[Meter] Recorded ${type}: ${quantity} for tenant ${tenantId} (key: ${idempotencyKey})`);
    } else {
        console.log(`[Meter] Duplicate key detected: ${idempotencyKey} — returning original event`);
    }

    return result;
}

/**
 * Record multiple token types from a single generation request.
 * Each token type gets its own usage event with a derived idempotency key.
 * 
 * @param {string} tenantId
 * @param {string} baseIdempotencyKey - Base key; each token type appends its suffix
 * @param {object} tokens - { inputTokens, cachedInputTokens, outputTokens, reasoningTokens }
 * @returns {{ events: object[], totalTokens: number, duplicates: number }}
 */
function recordGeneration(tenantId, baseIdempotencyKey, tokens) {
    const events = [];
    let totalTokens = 0;
    let duplicates = 0;

    const tokenEntries = [
        { key: 'inputTokens', type: 'input', value: tokens.inputTokens || 0 },
        { key: 'cachedInputTokens', type: 'cached_input', value: tokens.cachedInputTokens || 0 },
        { key: 'outputTokens', type: 'output', value: tokens.outputTokens || 0 },
        { key: 'reasoningTokens', type: 'reasoning', value: tokens.reasoningTokens || 0 },
    ];

    for (const entry of tokenEntries) {
        if (entry.value > 0) {
            const idempotencyKey = `${baseIdempotencyKey}:${entry.type}`;
            const result = record(tenantId, 'ai_tokens', entry.value, idempotencyKey, entry.type);
            events.push(result.event);
            totalTokens += entry.value;
            if (!result.created) duplicates++;
        }
    }

    // Also record the API call itself
    const apiCallResult = record(tenantId, 'api_call', 1, `${baseIdempotencyKey}:api_call`);
    events.push(apiCallResult.event);
    if (!apiCallResult.created) duplicates++;

    return { events, totalTokens, duplicates };
}

module.exports = { record, recordGeneration };
