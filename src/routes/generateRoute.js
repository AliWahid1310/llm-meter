/**
 * Generate Route — POST /api/generate
 * 
 * The dummy billable endpoint that exercises every rule:
 * 1. Validate input
 * 2. Check quota (before the action)
 * 3. Record usage (idempotent)
 * 4. Calculate cost
 * 5. Return result
 */

const express = require('express');
const router = express.Router();
const { validateGenerateRequest } = require('../middleware/validateInput');
const meterService = require('../services/meterService');
const quotaService = require('../services/quotaService');
const costService = require('../services/costService');
const tenantRepository = require('../db/repositories/tenantRepository');

router.post('/', validateGenerateRequest, (req, res) => {
    const { tenantId, inputTokens = 0, cachedInputTokens = 0, outputTokens = 0, reasoningTokens = 0 } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];

    // Calculate total tokens for quota check
    const totalTokens = inputTokens + cachedInputTokens + outputTokens + reasoningTokens;

    // Step 1: Verify tenant exists
    const tenant = tenantRepository.findById(tenantId);
    if (!tenant) {
        return res.status(404).json({
            error: true,
            statusCode: 404,
            message: `Tenant not found: ${tenantId}`,
        });
    }

    // Step 2: Check quota BEFORE the action
    const quotaResult = quotaService.checkGenerationQuota(tenantId, totalTokens);

    if (!quotaResult.allowed) {
        const check = quotaResult.check;
        return res.status(check.statusCode).json({
            error: true,
            statusCode: check.statusCode,
            message: check.message,
            quota: {
                used: check.used,
                limit: check.limit,
                remaining: check.remaining,
            },
        });
    }

    // Step 3: Record usage (idempotent — duplicate keys return original result)
    const meterResult = meterService.recordGeneration(tenantId, idempotencyKey, {
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
    });

    // Step 4: Calculate cost for this request
    const tokenBreakdown = {
        input: inputTokens,
        cached_input: cachedInputTokens,
        output: outputTokens,
        reasoning: reasoningTokens,
    };
    const requestCost = costService.calculateTokenCost(tokenBreakdown);
    const apiCallCost = costService.calculateApiCallCost(1);

    // Step 5: Return result
    const isDuplicate = meterResult.duplicates > 0;

    res.status(isDuplicate ? 200 : 201).json({
        success: true,
        duplicate: isDuplicate,
        message: isDuplicate
            ? 'Duplicate request detected — returning original result (no new charges)'
            : 'Usage recorded successfully',
        usage: {
            tenantId,
            billingPeriod: meterResult.events[0]?.billing_period,
            tokensRecorded: {
                inputTokens,
                cachedInputTokens,
                outputTokens,
                reasoningTokens,
                total: totalTokens,
            },
            apiCallRecorded: 1,
        },
        cost: {
            tokenCost: requestCost,
            apiCallCost,
            totalCostMicros: requestCost.totalTokenCostMicros + apiCallCost.totalCostMicros,
            totalCostDollars: `$${((requestCost.totalTokenCostMicros + apiCallCost.totalCostMicros) / 1000000).toFixed(6)}`,
        },
        idempotencyKey,
    });
});

module.exports = router;
