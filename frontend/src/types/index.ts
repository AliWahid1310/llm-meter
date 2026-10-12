export interface Tenant {
  id: string;
  name: string;
  email: string | null;
  plan: 'free' | 'pro';
  planDisplayName: string;
  apiCallLimit: number;
  aiTokenLimit: number;
  status: 'active' | 'suspended';
  stripeCustomerId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface TokenBreakdown {
  input: number;
  cached_input: number;
  output: number;
  reasoning: number;
}

export interface UsageSummary {
  tenant: {
    id: string;
    name: string;
    plan: string;
    planDisplayName: string;
  };
  billingPeriod: string;
  usage: {
    apiCalls: {
      used: number;
      limit: number;
      remaining: number;
      percentUsed: number;
    };
    aiTokens: {
      used: number;
      limit: number;
      remaining: number;
      percentUsed: number;
      breakdown: TokenBreakdown;
    };
  };
  cost: {
    totalCostMicros: number;
    totalCostDollars: string;
    apiCalls: {
      callCount: number;
      ratePerCallMicros: number;
      totalCostMicros: number;
    };
    tokens: {
      totalTokens: number;
      totalTokenCostMicros: number;
      breakdown: {
        input: { tokens: number; ratePer1M: number; costMicros: number };
        cachedInput: { tokens: number; ratePer1M: number; costMicros: number; discount: string };
        output: { tokens: number; ratePer1M: number; costMicros: number };
        reasoning: { tokens: number; ratePer1M: number; costMicros: number; note: string };
      };
    };
    pricingRules?: Record<string, string>;
  };
}

export interface GenerateResult {
  success: boolean;
  duplicate: boolean;
  message: string;
  usage: {
    tenantId: string;
    billingPeriod: string;
    tokensRecorded: {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      total: number;
    };
    apiCallRecorded: number;
  };
  cost: {
    tokenCost: {
      totalTokens: number;
      totalTokenCostMicros: number;
      breakdown: {
        input: { tokens: number; ratePer1M: number; costMicros: number };
        cachedInput: { tokens: number; ratePer1M: number; costMicros: number };
        output: { tokens: number; ratePer1M: number; costMicros: number };
        reasoning: { tokens: number; ratePer1M: number; costMicros: number };
      };
    };
    apiCallCost: {
      callCount: number;
      ratePerCallMicros: number;
      totalCostMicros: number;
    };
    totalCostMicros: number;
    totalCostDollars: string;
  };
  idempotencyKey: string;
}

export interface ApiError {
  error: boolean;
  statusCode: number;
  message: string;
  quota?: {
    used: number;
    limit: number;
    remaining: number;
  };
}
