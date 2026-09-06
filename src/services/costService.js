/**
 * Cost Service — converts usage into money.
 * 
 * CRITICAL RULES (from capstone spec):
 * 1. Cached input tokens are CHEAPER than standard input tokens
 * 2. Reasoning tokens are billed at the OUTPUT token rate
 * 3. Token categories CANNOT be simply added together — each is priced separately
 * 4. All money is stored as integers (micro-dollars), NEVER floats
 * 
 * Cost formula:
 *   token_cost = (token_count × rate_per_million) / 1,000,000
 *   Each category computed independently, then summed.
 */

const pricing = require('../config/pricing');
const usageRepository = require('../db/repositories/usageRepository');

/**
 * Calculate the cost for a specific token breakdown.
 * Each token type is priced SEPARATELY — they cannot be added first.
 * 
 * @param {object} tokenBreakdown - { input, cached_input, output, reasoning }
 * @returns {object} Cost breakdown in micro-dollars
 */
function calculateTokenCost(tokenBreakdown) {
    // Price each category independently (the core rule)
    const inputCost = Math.round(
        (tokenBreakdown.input * pricing.INPUT_TOKEN_RATE_PER_MILLION) / 1000000
    );

    const cachedInputCost = Math.round(
        (tokenBreakdown.cached_input * pricing.CACHED_INPUT_TOKEN_RATE_PER_MILLION) / 1000000
    );

    const outputCost = Math.round(
        (tokenBreakdown.output * pricing.OUTPUT_TOKEN_RATE_PER_MILLION) / 1000000
    );

    // Reasoning tokens billed at OUTPUT rate
    const reasoningCost = Math.round(
        (tokenBreakdown.reasoning * pricing.REASONING_TOKEN_RATE_PER_MILLION) / 1000000
    );

    const totalTokenCostMicros = inputCost + cachedInputCost + outputCost + reasoningCost;

    return {
        inputCostMicros: inputCost,
        cachedInputCostMicros: cachedInputCost,
        outputCostMicros: outputCost,
        reasoningCostMicros: reasoningCost,
        totalTokenCostMicros,
        breakdown: {
            input: {
                tokens: tokenBreakdown.input,
                ratePer1M: pricing.INPUT_TOKEN_RATE_PER_MILLION,
                costMicros: inputCost,
                costDollars: `$${(inputCost / pricing.MICROS_PER_DOLLAR).toFixed(6)}`,
            },
            cachedInput: {
                tokens: tokenBreakdown.cached_input,
                ratePer1M: pricing.CACHED_INPUT_TOKEN_RATE_PER_MILLION,
                costMicros: cachedInputCost,
                costDollars: `$${(cachedInputCost / pricing.MICROS_PER_DOLLAR).toFixed(6)}`,
            },
            output: {
                tokens: tokenBreakdown.output,
                ratePer1M: pricing.OUTPUT_TOKEN_RATE_PER_MILLION,
                costMicros: outputCost,
                costDollars: `$${(outputCost / pricing.MICROS_PER_DOLLAR).toFixed(6)}`,
            },
            reasoning: {
                tokens: tokenBreakdown.reasoning,
                ratePer1M: pricing.REASONING_TOKEN_RATE_PER_MILLION,
                costMicros: reasoningCost,
                costDollars: `$${(reasoningCost / pricing.MICROS_PER_DOLLAR).toFixed(6)}`,
                note: 'Billed at output token rate',
            },
        },
    };
}

/**
 * Calculate the cost for API calls.
 * 
 * @param {number} apiCallCount
 * @returns {object} API call cost
 */
function calculateApiCallCost(apiCallCount) {
    const costMicros = apiCallCount * pricing.API_CALL_COST_MICROS;
    return {
        count: apiCallCount,
        costPerCallMicros: pricing.API_CALL_COST_MICROS,
        totalCostMicros: costMicros,
        costDollars: `$${(costMicros / pricing.MICROS_PER_DOLLAR).toFixed(6)}`,
    };
}

/**
 * Calculate the total cost for a tenant in the current billing period.
 * 
 * @param {string} tenantId
 * @param {string} [billingPeriod] - YYYY-MM format (defaults to current month)
 * @returns {object} Complete cost breakdown
 */
function calculateTenantCost(tenantId, billingPeriod) {
    const usage = usageRepository.getUsageSummary(tenantId, billingPeriod);

    const tokenCost = calculateTokenCost(usage.tokenBreakdown);
    const apiCallCost = calculateApiCallCost(usage.apiCalls);

    const totalCostMicros = tokenCost.totalTokenCostMicros + apiCallCost.totalCostMicros;

    return {
        tenantId,
        billingPeriod: usage.billingPeriod,
        totalCostMicros,
        totalCostDollars: `$${(totalCostMicros / pricing.MICROS_PER_DOLLAR).toFixed(6)}`,
        apiCalls: apiCallCost,
        tokens: tokenCost,
        pricingRules: pricing.PRICING_TABLE,
    };
}

module.exports = { calculateTokenCost, calculateApiCallCost, calculateTenantCost };
