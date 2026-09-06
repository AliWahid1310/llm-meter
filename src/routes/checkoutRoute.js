/**
 * Checkout Route — POST /api/checkout
 * 
 * Creates a Stripe Checkout session for upgrading to Pro plan.
 */

const express = require('express');
const router = express.Router();
const { validateCheckoutRequest } = require('../middleware/validateInput');
const stripeService = require('../services/stripeService');

router.post('/', validateCheckoutRequest, async (req, res, next) => {
    try {
        const { tenantId } = req.body;

        const session = await stripeService.createCheckoutSession(tenantId);

        res.json({
            success: true,
            message: 'Checkout session created. Redirect the customer to the URL below.',
            sessionId: session.sessionId,
            url: session.url,
        });
    } catch (err) {
        // Handle known errors with proper status codes
        if (err.message.includes('not found')) {
            return res.status(404).json({
                error: true,
                statusCode: 404,
                message: err.message,
            });
        }
        if (err.message.includes('already on the Pro')) {
            return res.status(409).json({
                error: true,
                statusCode: 409,
                message: err.message,
            });
        }
        next(err);
    }
});

module.exports = router;
