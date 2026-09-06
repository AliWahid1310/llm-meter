/**
 * Tenant Route — GET /api/tenants and POST /api/tenants
 */

const express = require('express');
const router = express.Router();
const tenantRepository = require('../db/repositories/tenantRepository');
const { validateCreateTenant } = require('../middleware/validateInput');

/**
 * GET /api/tenants — list all tenants with plan details.
 */
router.get('/', (req, res) => {
    const tenants = tenantRepository.findAll();

    res.json({
        count: tenants.length,
        tenants: tenants.map(t => ({
            id: t.id,
            name: t.name,
            email: t.email,
            plan: t.plan_name,
            planDisplayName: t.plan_display_name,
            apiCallLimit: t.api_call_limit,
            aiTokenLimit: t.ai_token_limit,
            status: t.status,
            createdAt: t.created_at,
        })),
    });
});

/**
 * GET /api/tenants/:id — get a specific tenant.
 */
router.get('/:id', (req, res) => {
    const tenant = tenantRepository.findById(req.params.id);

    if (!tenant) {
        return res.status(404).json({
            error: true,
            statusCode: 404,
            message: `Tenant not found: ${req.params.id}`,
        });
    }

    res.json({
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan_name,
        planDisplayName: tenant.plan_display_name,
        apiCallLimit: tenant.api_call_limit,
        aiTokenLimit: tenant.ai_token_limit,
        stripeCustomerId: tenant.stripe_customer_id,
        status: tenant.status,
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
    });
});

/**
 * POST /api/tenants — create a new tenant (defaults to Free plan).
 */
router.post('/', validateCreateTenant, (req, res) => {
    const { name, email } = req.body;

    const tenant = tenantRepository.create({ name, email });

    res.status(201).json({
        message: 'Tenant created successfully',
        tenant: {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            plan: tenant.plan_name,
            planDisplayName: tenant.plan_display_name,
            apiCallLimit: tenant.api_call_limit,
            aiTokenLimit: tenant.ai_token_limit,
            status: tenant.status,
            createdAt: tenant.created_at,
        },
    });
});

module.exports = router;
