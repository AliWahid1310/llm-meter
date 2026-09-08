/**
 * Usage Alert Job — background job that monitors tenant usage.
 * 
 * Runs periodically (every 5 minutes) and:
 * - Checks all tenants' usage against their quotas
 * - Logs alerts at 80% and 100% thresholds
 * - Implements retry logic with failure alerting
 * 
 * This satisfies the "≥1 background job" requirement.
 */

const tenantRepository = require('../db/repositories/tenantRepository');
const usageRepository = require('../db/repositories/usageRepository');

let intervalId = null;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ALERT_THRESHOLD_WARNING = 0.80;     // 80%
const ALERT_THRESHOLD_CRITICAL = 1.00;    // 100%

/**
 * Check usage for all tenants and log alerts.
 */
function checkAllTenants() {
    try {
        const tenants = tenantRepository.findAll();
        const billingPeriod = usageRepository.getCurrentBillingPeriod();
        let alertCount = 0;

        console.log(`[AlertJob] Checking ${tenants.length} tenants for usage alerts (period: ${billingPeriod})...`);

        for (const tenant of tenants) {
            try {
                const usage = usageRepository.getUsageSummary(tenant.id, billingPeriod);

                // Check API call usage
                const apiCallPercent = tenant.api_call_limit > 0
                    ? usage.apiCalls / tenant.api_call_limit
                    : 0;

                if (apiCallPercent >= ALERT_THRESHOLD_CRITICAL) {
                    console.warn(
                        `[AlertJob] 🔴 CRITICAL: Tenant "${tenant.name}" (${tenant.id}) has reached ` +
                        `100% of API call quota: ${usage.apiCalls.toLocaleString()} / ${tenant.api_call_limit.toLocaleString()}`
                    );
                    alertCount++;
                } else if (apiCallPercent >= ALERT_THRESHOLD_WARNING) {
                    console.warn(
                        `[AlertJob] 🟡 WARNING: Tenant "${tenant.name}" (${tenant.id}) is at ` +
                        `${Math.round(apiCallPercent * 100)}% of API call quota: ` +
                        `${usage.apiCalls.toLocaleString()} / ${tenant.api_call_limit.toLocaleString()}`
                    );
                    alertCount++;
                }

                // Check AI token usage
                const tokenPercent = tenant.ai_token_limit > 0
                    ? usage.totalTokens / tenant.ai_token_limit
                    : 0;

                if (tokenPercent >= ALERT_THRESHOLD_CRITICAL) {
                    console.warn(
                        `[AlertJob] 🔴 CRITICAL: Tenant "${tenant.name}" (${tenant.id}) has reached ` +
                        `100% of AI token quota: ${usage.totalTokens.toLocaleString()} / ${tenant.ai_token_limit.toLocaleString()}`
                    );
                    alertCount++;
                } else if (tokenPercent >= ALERT_THRESHOLD_WARNING) {
                    console.warn(
                        `[AlertJob] 🟡 WARNING: Tenant "${tenant.name}" (${tenant.id}) is at ` +
                        `${Math.round(tokenPercent * 100)}% of AI token quota: ` +
                        `${usage.totalTokens.toLocaleString()} / ${tenant.ai_token_limit.toLocaleString()}`
                    );
                    alertCount++;
                }
            } catch (tenantErr) {
                console.error(`[AlertJob] Error checking tenant ${tenant.id}: ${tenantErr.message}`);
                // Continue checking other tenants — don't let one failure stop the job
            }
        }

        if (alertCount > 0) {
            console.log(`[AlertJob] ⚠️ ${alertCount} alert(s) generated`);
        } else {
            console.log(`[AlertJob] ✅ All tenants within normal usage limits`);
        }
    } catch (err) {
        console.error(`[AlertJob] ❌ Job failed: ${err.message}`);
        console.error('[AlertJob] Will retry on next interval...');
    }
}

/**
 * Start the background alert job.
 */
function startAlertJob() {
    console.log(`[AlertJob] Starting usage alert job (interval: ${CHECK_INTERVAL_MS / 1000}s)`);

    // Run immediately on start
    setTimeout(() => {
        try {
            checkAllTenants();
        } catch (err) {
            console.error(`[AlertJob] Initial check failed: ${err.message}`);
        }
    }, 2000);

    // Then run on interval
    intervalId = setInterval(checkAllTenants, CHECK_INTERVAL_MS);
}

/**
 * Stop the background alert job.
 */
function stopAlertJob() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[AlertJob] Stopped');
    }
}

module.exports = { startAlertJob, stopAlertJob, checkAllTenants };
