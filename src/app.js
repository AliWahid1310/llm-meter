/**
 * LLM Usage Metering & Billing Service — Main Application Entry Point
 * 
 * Wires together all layers:
 *   Middleware → Routes → Services → Repositories → Database
 * 
 * IMPORTANT: The /webhooks/stripe route must receive raw body (Buffer)
 * for Stripe signature verification. All other routes use JSON parsing.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { runMigrations, closeDb } = require('./db/database');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const generateRoute = require('./routes/generateRoute');
const usageRoute = require('./routes/usageRoute');
const tenantRoute = require('./routes/tenantRoute');
const checkoutRoute = require('./routes/checkoutRoute');
const webhookRoute = require('./routes/webhookRoute');

// Import background job
const { startAlertJob, stopAlertJob } = require('./jobs/usageAlertJob');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// Middleware
// ============================================================

// Security headers
app.use(helmet());

// CORS
app.use(cors());

// CRITICAL: Stripe webhooks need raw body for signature verification.
// This MUST come before the JSON body parser.
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON body parser for all other routes
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ============================================================
// Routes
// ============================================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'LLM Usage Metering & Billing Service',
        timestamp: new Date().toISOString(),
    });
});

// API routes
app.use('/api/generate', generateRoute);
app.use('/api/usage', usageRoute);
app.use('/api/tenants', tenantRoute);
app.use('/api/checkout', checkoutRoute);

// Webhook route (raw body)
app.use('/webhooks/stripe', webhookRoute);

// Checkout success/cancel pages (simple HTML responses)
app.get('/checkout/success', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>✅ Checkout Successful!</h1>
            <p>Your subscription has been activated. You are now on the <strong>Pro</strong> plan.</p>
            <p>Session ID: ${req.query.session_id || 'N/A'}</p>
        </body>
        </html>
    `);
});

app.get('/checkout/cancel', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Checkout Cancelled</h1>
            <p>Your subscription was not created. You can try again anytime.</p>
        </body>
        </html>
    `);
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: true,
        statusCode: 404,
        message: `Route not found: ${req.method} ${req.path}`,
    });
});

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================
// Server Startup
// ============================================================

function startServer() {
    // Run database migrations
    console.log('[App] Running database migrations...');
    runMigrations();

    // Start background jobs
    startAlertJob();

    // Start listening
    const server = app.listen(PORT, () => {
        console.log(`[App] ✅ Server running on http://localhost:${PORT}`);
        console.log(`[App] Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('[App] Endpoints:');
        console.log('  POST /api/generate        → Billable action (metered)');
        console.log('  GET  /api/usage/:tenantId  → Usage rollup & cost');
        console.log('  GET  /api/tenants          → List tenants');
        console.log('  POST /api/tenants          → Create tenant');
        console.log('  POST /api/checkout         → Stripe Checkout session');
        console.log('  POST /webhooks/stripe      → Stripe webhook handler');
        console.log('  GET  /health               → Health check');
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[App] Shutting down gracefully...');
        stopAlertJob();
        closeDb();
        server.close(() => {
            console.log('[App] Server closed.');
            process.exit(0);
        });
    });

    process.on('SIGTERM', () => {
        console.log('\n[App] SIGTERM received, shutting down...');
        stopAlertJob();
        closeDb();
        server.close(() => {
            process.exit(0);
        });
    });
}

// Only start the server if this file is run directly (not imported for testing)
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
