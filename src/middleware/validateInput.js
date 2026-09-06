/**
 * Input Validation Middleware — validates request bodies at the boundary.
 * 
 * Bad input → clean 400 error, never reaches the service layer.
 */

/**
 * Validate the /api/generate request body.
 */
function validateGenerateRequest(req, res, next) {
    const { tenantId, inputTokens, cachedInputTokens, outputTokens, reasoningTokens } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];

    const errors = [];

    if (!tenantId || typeof tenantId !== 'string') {
        errors.push('tenantId is required and must be a string');
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        errors.push('Idempotency-Key header is required');
    }

    // At least one token type should be provided
    const hasTokens = [inputTokens, cachedInputTokens, outputTokens, reasoningTokens]
        .some(v => v !== undefined && v !== null);

    if (!hasTokens) {
        errors.push('At least one token type must be provided (inputTokens, cachedInputTokens, outputTokens, reasoningTokens)');
    }

    // Validate each token field is a non-negative integer if provided
    const tokenFields = { inputTokens, cachedInputTokens, outputTokens, reasoningTokens };
    for (const [field, value] of Object.entries(tokenFields)) {
        if (value !== undefined && value !== null) {
            if (!Number.isInteger(value) || value < 0) {
                errors.push(`${field} must be a non-negative integer, got: ${value}`);
            }
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: true,
            statusCode: 400,
            message: 'Validation failed',
            details: errors,
        });
    }

    next();
}

/**
 * Validate the /api/tenants POST request body.
 */
function validateCreateTenant(req, res, next) {
    const { name } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push('name is required and must be a non-empty string');
    }

    if (req.body.email && typeof req.body.email !== 'string') {
        errors.push('email must be a string if provided');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: true,
            statusCode: 400,
            message: 'Validation failed',
            details: errors,
        });
    }

    next();
}

/**
 * Validate the /api/checkout POST request body.
 */
function validateCheckoutRequest(req, res, next) {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({
            error: true,
            statusCode: 400,
            message: 'Validation failed',
            details: ['tenantId is required and must be a string'],
        });
    }

    next();
}

module.exports = {
    validateGenerateRequest,
    validateCreateTenant,
    validateCheckoutRequest,
};
