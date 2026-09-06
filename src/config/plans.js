/**
 * Plan Configuration — defines subscription tiers and their quotas.
 * 
 * Free: 1,000 API calls/month, 100,000 AI tokens/month
 * Pro:  50,000 API calls/month, 5,000,000 AI tokens/month, $29/month
 */

module.exports = {
    free: {
        id: 'free',
        name: 'free',
        displayName: 'Free',
        apiCallLimit: 1000,
        aiTokenLimit: 100000,
        priceCents: 0,
    },
    pro: {
        id: 'pro',
        name: 'pro',
        displayName: 'Pro',
        apiCallLimit: 50000,
        aiTokenLimit: 5000000,
        priceCents: 2900,   // $29.00/month
    },
};
