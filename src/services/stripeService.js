/**
 * Stripe Service — handles Checkout sessions and webhook event processing.
 * 
 * Payment truth lives at Stripe; our database MIRRORS it through verified events only.
 * - Checkout: creates a Stripe Checkout session for Pro upgrade
 * - Webhooks: processes verified events to sync subscription state
 */

const tenantRepository = require('../db/repositories/tenantRepository');
const subscriptionRepository = require('../db/repositories/subscriptionRepository');
const webhookEventRepository = require('../db/repositories/webhookEventRepository');
const planConfig = require('../config/plans');

/**
 * Get a configured Stripe instance.
 * Lazy-loaded to allow .env to be loaded first.
 */
function getStripe() {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return stripe;
}

/**
 * Create a Stripe Checkout session for upgrading to Pro.
 * 
 * @param {string} tenantId
 * @returns {object} { sessionId, url } — the Checkout session details
 */
async function createCheckoutSession(tenantId) {
    const stripe = getStripe();
    const tenant = tenantRepository.findById(tenantId);

    if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
    }

    if (tenant.plan_name === 'pro') {
        throw new Error('Tenant is already on the Pro plan.');
    }

    // Create or reuse Stripe customer
    let stripeCustomerId = tenant.stripe_customer_id;

    if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
            name: tenant.name,
            email: tenant.email || undefined,
            metadata: { tenantId: tenant.id },
        });
        stripeCustomerId = customer.id;
        tenantRepository.updateStripeCustomerId(tenantId, stripeCustomerId);
    }

    const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: process.env.STRIPE_PRO_PRICE_ID,
                quantity: 1,
            },
        ],
        success_url: `${process.env.BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL}/checkout/cancel`,
        metadata: {
            tenantId: tenant.id,
        },
    });

    console.log(`[Stripe] Checkout session created for tenant ${tenantId}: ${session.id}`);

    return {
        sessionId: session.id,
        url: session.url,
    };
}

/**
 * Handle a verified Stripe webhook event.
 * 
 * Deduplicates events using the webhook_events table.
 * Processes: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
 * 
 * @param {object} event - The verified Stripe event object
 * @returns {{ processed: boolean, action: string }}
 */
function handleWebhookEvent(event) {
    // Step 1: Deduplicate — check if we've already processed this event
    const isNew = webhookEventRepository.markProcessed(event.id, event.type);

    if (!isNew) {
        console.log(`[Stripe] Duplicate event ignored: ${event.id} (${event.type})`);
        return { processed: false, action: 'duplicate_ignored' };
    }

    console.log(`[Stripe] Processing event: ${event.id} (${event.type})`);

    // Step 2: Handle the event based on type
    switch (event.type) {
        case 'checkout.session.completed':
            return handleCheckoutCompleted(event.data.object);

        case 'customer.subscription.updated':
            return handleSubscriptionUpdated(event.data.object);

        case 'customer.subscription.deleted':
            return handleSubscriptionDeleted(event.data.object);

        default:
            console.log(`[Stripe] Unhandled event type: ${event.type}`);
            return { processed: true, action: 'unhandled_event_type' };
    }
}

/**
 * Handle checkout.session.completed — tenant upgrades to Pro.
 */
function handleCheckoutCompleted(session) {
    const tenantId = session.metadata?.tenantId;
    const stripeCustomerId = session.customer;
    const stripeSubscriptionId = session.subscription;

    if (!tenantId) {
        console.error('[Stripe] checkout.session.completed missing tenantId in metadata');
        return { processed: true, action: 'error_missing_tenant_id' };
    }

    // Update tenant to Pro plan
    tenantRepository.updatePlan(tenantId, 'pro');
    tenantRepository.updateStripeCustomerId(tenantId, stripeCustomerId);

    // Create subscription record
    subscriptionRepository.create({
        tenantId,
        planId: 'pro',
        stripeSubscriptionId,
        stripeCustomerId,
        status: 'active',
    });

    console.log(`[Stripe] Tenant ${tenantId} upgraded to Pro via checkout`);
    return { processed: true, action: 'upgraded_to_pro' };
}

/**
 * Handle customer.subscription.updated — plan or status change.
 */
function handleSubscriptionUpdated(subscription) {
    const stripeSubscriptionId = subscription.id;
    const status = subscription.status;

    // Find existing subscription
    const existing = subscriptionRepository.findByStripeSubscriptionId(stripeSubscriptionId);

    if (existing) {
        subscriptionRepository.update(stripeSubscriptionId, {
            status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        });

        // If subscription is no longer active, consider downgrading
        if (status === 'past_due' || status === 'unpaid') {
            tenantRepository.updateStatus(existing.tenant_id, 'suspended');
            console.log(`[Stripe] Tenant ${existing.tenant_id} suspended due to ${status} subscription`);
        }
    }

    console.log(`[Stripe] Subscription ${stripeSubscriptionId} updated: ${status}`);
    return { processed: true, action: 'subscription_updated' };
}

/**
 * Handle customer.subscription.deleted — downgrade to Free.
 */
function handleSubscriptionDeleted(subscription) {
    const stripeSubscriptionId = subscription.id;

    const existing = subscriptionRepository.findByStripeSubscriptionId(stripeSubscriptionId);

    if (existing) {
        subscriptionRepository.cancel(stripeSubscriptionId);
        tenantRepository.updatePlan(existing.tenant_id, 'free');
        tenantRepository.updateStatus(existing.tenant_id, 'active');

        console.log(`[Stripe] Tenant ${existing.tenant_id} downgraded to Free (subscription canceled)`);
    }

    return { processed: true, action: 'downgraded_to_free' };
}

module.exports = { createCheckoutSession, handleWebhookEvent };
