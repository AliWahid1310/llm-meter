/**
 * Pricing Configuration — pinned constants for cost calculation.
 * 
 * All prices are in MICRO-DOLLARS (1 micro-dollar = $0.000001).
 * This avoids floating-point errors entirely.
 * 
 * Rates are per-token (derived from per-1M-token pricing).
 * 
 * Source: Modeled after Gemini API pricing tiers.
 * 
 * Per 1M tokens pricing:
 *   Input tokens:        $0.075   → 75,000 micro-$ per 1M → 0.075 micro-$ per token
 *   Cached input tokens: $0.01875 → 18,750 micro-$ per 1M → 0.01875 micro-$ per token
 *   Output tokens:       $0.30    → 300,000 micro-$ per 1M → 0.30 micro-$ per token
 *   Reasoning tokens:    $0.30    → billed at OUTPUT rate (not free, not separate)
 * 
 * To avoid sub-micro-dollar fractions, we store rates as micro-dollars per 1M tokens
 * and compute: cost_micros = (token_count * rate_per_million) / 1_000_000
 */

module.exports = {
    // Token pricing — micro-dollars per 1 MILLION tokens
    INPUT_TOKEN_RATE_PER_MILLION: 75000,           // $0.075 per 1M tokens
    CACHED_INPUT_TOKEN_RATE_PER_MILLION: 18750,    // $0.01875 per 1M tokens (75% cheaper)
    OUTPUT_TOKEN_RATE_PER_MILLION: 300000,          // $0.30 per 1M tokens
    REASONING_TOKEN_RATE_PER_MILLION: 300000,       // $0.30 per 1M (billed as output)

    // API call pricing — micro-dollars per call
    API_CALL_COST_MICROS: 100,                     // $0.0001 per API call

    // Conversion helpers
    MICROS_PER_DOLLAR: 1000000,

    /**
     * Human-readable pricing table for documentation/API responses.
     */
    PRICING_TABLE: {
        inputTokens: { perMillionTokens: '$0.075', microDollarsPerMillion: 75000 },
        cachedInputTokens: { perMillionTokens: '$0.01875', microDollarsPerMillion: 18750 },
        outputTokens: { perMillionTokens: '$0.30', microDollarsPerMillion: 300000 },
        reasoningTokens: { perMillionTokens: '$0.30 (billed as output)', microDollarsPerMillion: 300000 },
        apiCall: { perCall: '$0.0001', microDollarsPerCall: 100 },
    },
};
