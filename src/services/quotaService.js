/**
 * Quota Service — enforces plan limits before allowing billable actions.
 * 
 * Quota is checked BEFORE the action, not after.
 * At the limit → 429 Too Many Requests
 * Plan expired/needs upgrade → 402 Payment Required
 */

const usageRepository = require('../db/repositories/usageRepository');
const tenantRepository = require('../db/repositories/tenantRepository');

/**
 * Check if a tenant can perform a billable action.
 * 
 * @param {string} tenantId
 * @param {string} type - 'api_call' or 'ai_tokens'
 * @param {number} requestedQuantity - How much the request wants to use
 * 
 * @returns {{ allowed: boolean, statusCode: number|null, used: number, limit: number, remaining: number, message: string }}
 */
function checkQuota(tenantId, type, requestedQuantity) {
    // Get tenant with plan details
    const tenant = tenantRepository.findById(tenantId);

    if (!tenant) {
        return {
            allowed: false,
            statusCode: 404,
            used: 0,
            limit: 0,
            remaining: 0,
            message: `Tenant not found: ${tenantId}`,
        };
    }

    // Check tenant status
    if (tenant.status === 'suspended') {
        return {
            allowed: false,
            statusCode: 402,
            used: 0,
            limit: 0,
            remaining: 0,
            message: 'Account suspended. Please contact support or update your payment method.',
        };
    }

    // Determine the limit based on type
    let limit;
    if (type === 'api_call') {
        limit = tenant.api_call_limit;
    } else if (type === 'ai_tokens') {
        limit = tenant.ai_token_limit;
    } else {
        return {
            allowed: false,
            statusCode: 400,
            used: 0,
            limit: 0,
            remaining: 0,
            message: `Invalid usage type: ${type}. Must be "api_call" or "ai_tokens".`,
        };
    }

    // Get current usage for the billing period
    const currentUsage = usageRepository.countByType(tenantId, type);
    const remaining = Math.max(0, limit - currentUsage);

    // Check if adding the requested quantity would exceed the limit
    if (currentUsage + requestedQuantity > limit) {
        // Determine the right status code
        const statusCode = tenant.plan_name === 'free' ? 402 : 429;
        const action = tenant.plan_name === 'free'
            ? 'Upgrade to Pro for higher limits.'
            : 'You have reached your monthly quota. Usage resets at the start of the next billing period.';

        return {
            allowed: false,
            statusCode,
            used: currentUsage,
            limit,
            remaining,
            message: `${type === 'api_call' ? 'API call' : 'AI token'} quota exceeded. `
                + `Used: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}. `
                + `Requested: ${requestedQuantity.toLocaleString()}, Available: ${remaining.toLocaleString()}. `
                + action,
        };
    }

    return {
        allowed: true,
        statusCode: null,
        used: currentUsage,
        limit,
        remaining: remaining - requestedQuantity,
        message: 'Quota check passed.',
    };
}

/**
 * Check quota for a full generation request (API call + tokens).
 * 
 * @param {string} tenantId
 * @param {number} totalTokens - Total tokens across all types
 * @returns {{ allowed: boolean, apiCallCheck: object, tokenCheck: object }}
 */
function checkGenerationQuota(tenantId, totalTokens) {
    const apiCallCheck = checkQuota(tenantId, 'api_call', 1);
    const tokenCheck = checkQuota(tenantId, 'ai_tokens', totalTokens);

    // Both must pass
    const allowed = apiCallCheck.allowed && tokenCheck.allowed;

    // Return the first failure if any
    if (!apiCallCheck.allowed) {
        return { allowed: false, check: apiCallCheck };
    }
    if (!tokenCheck.allowed) {
        return { allowed: false, check: tokenCheck };
    }

    return { allowed: true, check: { apiCallCheck, tokenCheck } };
}

module.exports = { checkQuota, checkGenerationQuota };
