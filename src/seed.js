/**
 * Seed Script — populates the database with demo data.
 * 
 * Creates:
 * - Free and Pro plans with documented quotas
 * - Demo tenants for testing
 * - Initial subscriptions
 * 
 * Run with: npm run seed (or: node src/seed.js)
 */

require('dotenv').config();

const { runMigrations, closeDb } = require('./db/database');
const planRepository = require('./db/repositories/planRepository');
const tenantRepository = require('./db/repositories/tenantRepository');
const subscriptionRepository = require('./db/repositories/subscriptionRepository');
const planConfig = require('./config/plans');

function seed() {
    console.log('[Seed] Starting database seeding...\n');

    // Step 1: Run migrations (idempotent)
    runMigrations();

    // Step 2: Seed plans
    console.log('[Seed] Creating plans...');
    for (const [key, plan] of Object.entries(planConfig)) {
        planRepository.upsert({
            id: plan.id,
            name: plan.name,
            displayName: plan.displayName,
            apiCallLimit: plan.apiCallLimit,
            aiTokenLimit: plan.aiTokenLimit,
            priceCents: plan.priceCents,
        });
        console.log(`  ✅ Plan "${plan.displayName}" — ${plan.apiCallLimit.toLocaleString()} API calls, ${plan.aiTokenLimit.toLocaleString()} tokens/month`);
    }

    // Step 3: Seed demo tenants
    console.log('\n[Seed] Creating demo tenants...');

    // Check if demo tenants already exist
    const existingTenants = tenantRepository.findAll();
    const existingNames = existingTenants.map(t => t.name);

    const demoTenants = [
        { name: 'Acme Corp', email: 'admin@acme.example.com', planId: 'free' },
        { name: 'TechStart Inc', email: 'hello@techstart.example.com', planId: 'free' },
        { name: 'Enterprise Co', email: 'billing@enterprise.example.com', planId: 'pro' },
    ];

    const createdTenants = [];

    for (const demo of demoTenants) {
        if (existingNames.includes(demo.name)) {
            const existing = existingTenants.find(t => t.name === demo.name);
            console.log(`  ⏭️  Tenant "${demo.name}" already exists (${existing.id})`);
            createdTenants.push(existing);
            continue;
        }

        const tenant = tenantRepository.create(demo);
        console.log(`  ✅ Tenant "${tenant.name}" (${tenant.id}) — Plan: ${tenant.plan_display_name}`);
        createdTenants.push(tenant);

        // Create a subscription record for Pro tenants
        if (demo.planId === 'pro') {
            subscriptionRepository.create({
                tenantId: tenant.id,
                planId: 'pro',
                status: 'active',
            });
            console.log(`     └─ Subscription created (active)`);
        }
    }

    // Step 4: Print summary
    console.log('\n[Seed] ✅ Seeding complete!\n');
    console.log('Demo tenants for testing:');
    console.log('─'.repeat(60));

    for (const tenant of createdTenants) {
        console.log(`  ID:    ${tenant.id}`);
        console.log(`  Name:  ${tenant.name}`);
        console.log(`  Plan:  ${tenant.plan_display_name || tenant.plan_name}`);
        console.log(`  Email: ${tenant.email || 'N/A'}`);
        console.log('─'.repeat(60));
    }

    console.log('\nQuick test commands:');
    console.log(`\n  # List all tenants`);
    console.log(`  curl http://localhost:3000/api/tenants`);
    console.log(`\n  # Send a billable request (replace TENANT_ID)`);
    console.log(`  curl -X POST http://localhost:3000/api/generate \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -H "Idempotency-Key: test-key-001" \\`);
    console.log(`    -d '{"tenantId":"TENANT_ID","inputTokens":1000,"outputTokens":200}'`);
    console.log(`\n  # Check usage`);
    console.log(`  curl http://localhost:3000/api/usage/TENANT_ID`);
}

try {
    seed();
} catch (err) {
    console.error('[Seed] ❌ Seeding failed:', err.message);
    process.exit(1);
} finally {
    closeDb();
}
