/**
 * Usage Route — GET /api/usage/:tenantId
 * 
 * Returns current usage rollup: used, limit, cost, breakdown.
 */

const express = require('express');
const router = express.Router();
const tenantRepository = require('../db/repositories/tenantRepository');
const usageRepository = require('../db/repositories/usageRepository');
const costService = require('../services/costService');

router.get('/:tenantId', (req, res) => {
    const { tenantId } = req.params;
    const { period } = req.query;  // optional: ?period=2025-09

    // Verify tenant exists
    const tenant = tenantRepository.findById(tenantId);
    if (!tenant) {
        return res.status(404).json({
            error: true,
            statusCode: 404,
            message: `Tenant not found: ${tenantId}`,
        });
    }

    // Get usage summary
    const usage = usageRepository.getUsageSummary(tenantId, period);

    // Calculate costs
    const cost = costService.calculateTenantCost(tenantId, period);

    res.json({
        tenant: {
            id: tenant.id,
            name: tenant.name,
            plan: tenant.plan_name,
            planDisplayName: tenant.plan_display_name,
        },
        billingPeriod: usage.billingPeriod,
        usage: {
            apiCalls: {
                used: usage.apiCalls,
                limit: tenant.api_call_limit,
                remaining: Math.max(0, tenant.api_call_limit - usage.apiCalls),
                percentUsed: tenant.api_call_limit > 0
                    ? Math.round((usage.apiCalls / tenant.api_call_limit) * 100)
                    : 0,
            },
            aiTokens: {
                used: usage.totalTokens,
                limit: tenant.ai_token_limit,
                remaining: Math.max(0, tenant.ai_token_limit - usage.totalTokens),
                percentUsed: tenant.ai_token_limit > 0
                    ? Math.round((usage.totalTokens / tenant.ai_token_limit) * 100)
                    : 0,
                breakdown: usage.tokenBreakdown,
            },
        },
        cost: {
            totalCostMicros: cost.totalCostMicros,
            totalCostDollars: cost.totalCostDollars,
            apiCalls: cost.apiCalls,
            tokens: cost.tokens,
            pricingRules: cost.pricingRules,
        },
    });
});

module.exports = router;
