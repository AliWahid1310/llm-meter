/**
 * Webhook Route — POST /webhooks/stripe
 * 
 * Receives Stripe webhook events with:
 * 1. Signature verification (forged → 400)
 * 2. Event deduplication (replay → ignored)
 * 3. Plan/subscription synchronization
 * 
 * IMPORTANT: This route must receive the RAW body (not JSON-parsed)
 * for Stripe signature verification to work. The raw body middleware
 * is configured in app.js.
 */

const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');

router.post('/', (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        return res.status(400).json({
            error: true,
            statusCode: 400,
            message: 'Missing Stripe-Signature header',
        });
    }

    // Verify the webhook signature
    let event;
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(
            req.body,  // raw body (Buffer)
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`[Webhook] Signature verification failed: ${err.message}`);
        return res.status(400).json({
            error: true,
            statusCode: 400,
            message: `Webhook signature verification failed: ${err.message}`,
        });
    }

    // Process the verified event (with deduplication)
    try {
        const result = stripeService.handleWebhookEvent(event);

        res.json({
            received: true,
            eventId: event.id,
            eventType: event.type,
            ...result,
        });
    } catch (err) {
        console.error(`[Webhook] Error processing event ${event.id}: ${err.message}`);
        // Return 200 to prevent Stripe from retrying — we logged the error
        res.status(200).json({
            received: true,
            eventId: event.id,
            error: err.message,
        });
    }
});

module.exports = router;
