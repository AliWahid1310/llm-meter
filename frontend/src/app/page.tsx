'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import { Tenant, UsageSummary, GenerateResult, ApiError } from '../types';

export default function DashboardPage() {
  // System Connection State
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Tenant & Data State
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTenantName, setNewTenantName] = useState<string>('');
  const [newTenantEmail, setNewTenantEmail] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);

  // Simulator / API Console State
  const [inputTokens, setInputTokens] = useState<number>(1200);
  const [cachedInputTokens, setCachedInputTokens] = useState<number>(800);
  const [outputTokens, setOutputTokens] = useState<number>(450);
  const [reasoningTokens, setReasoningTokens] = useState<number>(200);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(`req_${Date.now()}`);
  const [reuseKey, setReuseKey] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [genResponse, setGenResponse] = useState<GenerateResult | ApiError | null>(null);
  const [genHttpStatus, setGenHttpStatus] = useState<number | null>(null);

  // Stripe Upgrade State
  const [upgrading, setUpgrading] = useState<boolean>(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  // Health check
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3000/health');
      setBackendHealthy(res.ok);
    } catch {
      setBackendHealthy(false);
    }
  }, []);

  // Fetch tenants
  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3000/api/tenants');
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
        if (data.tenants?.length > 0 && !selectedTenantId) {
          setSelectedTenantId(data.tenants[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  }, [selectedTenantId]);

  // Fetch usage for active tenant
  const fetchUsage = useCallback(async (tenantId: string) => {
    if (!tenantId) return;
    try {
      const res = await fetch(`http://localhost:3000/api/usage/${tenantId}`);
      if (res.ok) {
        const data: UsageSummary = await res.json();
        setUsage(data);
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    fetchTenants();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth, fetchTenants]);

  useEffect(() => {
    if (selectedTenantId) {
      fetchUsage(selectedTenantId);
    }
  }, [selectedTenantId, fetchUsage]);

  const handleCopyTenantId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;

    setCreateLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTenantName.trim(),
          email: newTenantEmail.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsModalOpen(false);
        setNewTenantName('');
        setNewTenantEmail('');
        await fetchTenants();
        if (data.tenant?.id) {
          setSelectedTenantId(data.tenant.id);
        }
      }
    } catch (err) {
      console.error('Failed to create tenant:', err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleNewKey = () => {
    setIdempotencyKey(`req_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`);
  };

  const applyPreset = (preset: 'chat' | 'rag' | 'reasoning' | 'stress') => {
    if (!reuseKey) handleNewKey();
    if (preset === 'chat') {
      setInputTokens(850);
      setCachedInputTokens(200);
      setOutputTokens(350);
      setReasoningTokens(0);
    } else if (preset === 'rag') {
      setInputTokens(24000);
      setCachedInputTokens(18000);
      setOutputTokens(1200);
      setReasoningTokens(0);
    } else if (preset === 'reasoning') {
      setInputTokens(4500);
      setCachedInputTokens(1200);
      setOutputTokens(2200);
      setReasoningTokens(6500);
    } else if (preset === 'stress') {
      setInputTokens(75000);
      setCachedInputTokens(10000);
      setOutputTokens(12000);
      setReasoningTokens(5000);
    }
  };

  const handleSendGeneration = async () => {
    if (!selectedTenantId) return;

    setGenerating(true);
    setGenResponse(null);
    setGenHttpStatus(null);

    const activeKey = idempotencyKey;

    try {
      const res = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': activeKey,
        },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          inputTokens,
          cachedInputTokens,
          outputTokens,
          reasoningTokens,
        }),
      });

      setGenHttpStatus(res.status);
      const data = await res.json();
      setGenResponse(data);

      await fetchUsage(selectedTenantId);

      if (!reuseKey) {
        handleNewKey();
      }
    } catch (err: unknown) {
      setGenHttpStatus(500);
      setGenResponse({
        error: true,
        statusCode: 500,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedTenantId) return;
    setUpgrading(true);
    setCheckoutMessage(null);

    try {
      const res = await fetch('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedTenantId }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, '_blank');
      } else {
        setCheckoutMessage(data.message || 'Stripe test session generated.');
      }
    } catch (err: unknown) {
      setCheckoutMessage(err instanceof Error ? err.message : 'Stripe checkout error');
    } finally {
      setUpgrading(false);
    }
  };

  const activeTenant = tenants.find(t => t.id === selectedTenantId);

  const breakdown = usage?.usage.aiTokens.breakdown || { input: 0, cached_input: 0, output: 0, reasoning: 0 };
  const totalBreakdownTokens = (breakdown.input + breakdown.cached_input + breakdown.output + breakdown.reasoning) || 1;
  const pctInput = ((breakdown.input / totalBreakdownTokens) * 100).toFixed(1);
  const pctCached = ((breakdown.cached_input / totalBreakdownTokens) * 100).toFixed(1);
  const pctOutput = ((breakdown.output / totalBreakdownTokens) * 100).toFixed(1);
  const pctReasoning = ((breakdown.reasoning / totalBreakdownTokens) * 100).toFixed(1);

  const apiCallsPercent = usage?.usage.apiCalls.percentUsed || 0;
  const tokensPercent = usage?.usage.aiTokens.percentUsed || 0;

  return (
    <div className={styles.container}>
      {/* Executive Top Navigation */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandGroup}>
            <div className={styles.brandLogo}>M</div>
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>METERFLOW</div>
              <div className={styles.brandSubtitle}>LLM Usage & Billing Infrastructure</div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.statusIndicator}>
              <span className={backendHealthy ? styles.statusDotGreen : styles.statusDotRed} />
              <span>{backendHealthy ? 'API Engine Active' : 'API Offline'}</span>
            </div>

            <div className="badge badge-yellow">
              CYCLE: {usage?.billingPeriod || '2026-10'}
            </div>

            <button
              id="new-tenant-btn"
              className={styles.btnBlack}
              onClick={() => setIsModalOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Tenant
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className={styles.main}>
        {/* Context Bar */}
        <section className={styles.contextBar}>
          <div className={styles.contextLeft}>
            <div className={styles.tenantSelectWrapper}>
              <span className={styles.tenantLabel}>Tenant</span>
              <select
                id="tenant-select"
                className={styles.tenantSelect}
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.plan === 'pro' ? 'Pro' : 'Free'})
                  </option>
                ))}
              </select>
            </div>

            {activeTenant && (
              <div className={styles.tenantMeta}>
                <span className={`badge ${activeTenant.plan === 'pro' ? 'badge-yellow' : 'badge-outline'}`}>
                  {activeTenant.plan === 'pro' ? 'PRO PLAN' : 'FREE TIER'}
                </span>

                <span className={`badge ${activeTenant.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                  {activeTenant.status.toUpperCase()}
                </span>

                <div
                  className={styles.tenantIdChip}
                  onClick={() => handleCopyTenantId(activeTenant.id)}
                  title="Copy Tenant ID"
                >
                  <span className="mono">{activeTenant.id.slice(0, 14)}...</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                  {copiedId && <span style={{ color: '#16a34a', fontWeight: 700 }}>Copied</span>}
                </div>

                {activeTenant.email && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {activeTenant.email}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            id="refresh-stats-btn"
            className={styles.btnGhost}
            onClick={() => selectedTenantId && fetchUsage(selectedTenantId)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
            Sync Data
          </button>
        </section>

        {/* Executive KPI Cards */}
        <section className={styles.kpiGrid}>
          {/* AI Tokens Metric */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>Monthly AI Tokens</span>
              <span className={`badge ${tokensPercent > 90 ? 'badge-danger' : tokensPercent > 70 ? 'badge-yellow' : 'badge-outline'}`}>
                {tokensPercent}% consumed
              </span>
            </div>

            <div className={styles.kpiValueRow}>
              <span className={`${styles.kpiBigNumber} mono`}>
                {usage?.usage.aiTokens.used.toLocaleString() ?? 0}
              </span>
              <span className={styles.kpiSubText}>
                / {usage?.usage.aiTokens.limit.toLocaleString() ?? '100,000'}
              </span>
            </div>

            <div className={styles.kpiProgressTrack}>
              <div
                className={`${styles.kpiProgressFill} ${
                  tokensPercent > 90 ? styles.progressRed : tokensPercent > 70 ? styles.progressYellow : styles.progressBlack
                }`}
                style={{ width: `${Math.min(100, tokensPercent)}%` }}
              />
            </div>

            <div className={styles.kpiFooter}>
              <span>Remaining: <strong>{usage?.usage.aiTokens.remaining.toLocaleString() ?? 0}</strong></span>
              <span>Pre-action quota check</span>
            </div>
          </div>

          {/* API Invocations Metric */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>API Invocations</span>
              <span className={`badge ${apiCallsPercent > 90 ? 'badge-danger' : apiCallsPercent > 70 ? 'badge-yellow' : 'badge-outline'}`}>
                {apiCallsPercent}% consumed
              </span>
            </div>

            <div className={styles.kpiValueRow}>
              <span className={`${styles.kpiBigNumber} mono`}>
                {usage?.usage.apiCalls.used.toLocaleString() ?? 0}
              </span>
              <span className={styles.kpiSubText}>
                / {usage?.usage.apiCalls.limit.toLocaleString() ?? '1,000'} calls
              </span>
            </div>

            <div className={styles.kpiProgressTrack}>
              <div
                className={`${styles.kpiProgressFill} ${
                  apiCallsPercent > 90 ? styles.progressRed : apiCallsPercent > 70 ? styles.progressYellow : styles.progressBlack
                }`}
                style={{ width: `${Math.min(100, apiCallsPercent)}%` }}
              />
            </div>

            <div className={styles.kpiFooter}>
              <span>Remaining: <strong>{usage?.usage.apiCalls.remaining.toLocaleString() ?? 0}</strong></span>
              <span>$0.0001 / invocation</span>
            </div>
          </div>

          {/* Calculated Spend (USD) Metric */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>Accrued Spend (USD)</span>
              <span className="badge badge-yellow">INTEGER MATH</span>
            </div>

            <div className={styles.kpiValueRow}>
              <span className={`${styles.kpiBigNumber} mono`} style={{ color: 'var(--black-primary)' }}>
                {usage?.cost.totalCostDollars ?? '$0.000000'}
              </span>
            </div>

            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Micro-Dollars: <strong className="mono" style={{ color: 'var(--black-primary)' }}>{usage?.cost.totalCostMicros.toLocaleString() ?? 0} µ$</strong>
            </div>

            <div className={styles.kpiFooter}>
              <span>Tokens: {usage?.cost.tokens.totalTokenCostMicros.toLocaleString() ?? 0} µ$</span>
              <span>Calls: {usage?.cost.apiCalls.totalCostMicros.toLocaleString() ?? 0} µ$</span>
            </div>
          </div>

          {/* Quota Health Metric */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>Quota Integrity</span>
              <span className="badge badge-success">PROTECTED</span>
            </div>

            <div className={styles.kpiValueRow} style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--black-primary)' }}>
                  {tokensPercent >= 100 || apiCallsPercent >= 100 ? 'Quota Limit Reached' : 'Allowance Healthy'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Enforced at boundary with HTTP 402/429
                </span>
              </div>
            </div>

            <div className={styles.kpiFooter} style={{ marginTop: 'auto' }}>
              <span>Deduplication: Active</span>
              <span>Idempotency: Enforced</span>
            </div>
          </div>
        </section>

        {/* Two-Column Workspace: Token Architecture & Developer Simulator */}
        <section className={styles.contentSplit}>
          {/* Left: Token Architecture & Rate Card */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Token Category Breakdown & Pricing Rules
                </div>
                <div className={styles.panelDesc}>
                  Categories are calculated independently at specific contract rates.
                </div>
              </div>

              <span className="badge badge-outline">4 TIERS</span>
            </div>

            <div className={styles.panelBody}>
              {/* Proportional Segment Bar */}
              <div className={styles.tokenBarContainer}>
                <div className={styles.tokenBarTrack}>
                  <div className={styles.tokenSegBlack} style={{ width: `${pctInput}%` }} title={`Input: ${pctInput}%`} />
                  <div className={styles.tokenSegYellow} style={{ width: `${pctCached}%` }} title={`Cached: ${pctCached}%`} />
                  <div className={styles.tokenSegCharcoal} style={{ width: `${pctOutput}%` }} title={`Output: ${pctOutput}%`} />
                  <div className={styles.tokenSegAmber} style={{ width: `${pctReasoning}%` }} title={`Reasoning: ${pctReasoning}%`} />
                </div>
              </div>

              {/* Breakdown Table */}
              <table className={styles.tokenTable}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Volume</th>
                    <th>Unit Rate</th>
                    <th>Total (µ$)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className={styles.dotIndicator} style={{ background: '#09090b' }} />
                      <strong>Standard Input</strong>
                    </td>
                    <td className="mono">{breakdown.input.toLocaleString()}</td>
                    <td>$0.075 / 1M</td>
                    <td className="mono"><strong>{usage?.cost.tokens.breakdown.input.costMicros.toLocaleString() ?? 0}</strong></td>
                  </tr>

                  <tr>
                    <td>
                      <span className={styles.dotIndicator} style={{ background: '#eab308' }} />
                      <strong>Cached Input</strong>
                      <span className="badge badge-yellow" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>-75%</span>
                    </td>
                    <td className="mono">{breakdown.cached_input.toLocaleString()}</td>
                    <td>$0.01875 / 1M</td>
                    <td className="mono"><strong>{usage?.cost.tokens.breakdown.cachedInput.costMicros.toLocaleString() ?? 0}</strong></td>
                  </tr>

                  <tr>
                    <td>
                      <span className={styles.dotIndicator} style={{ background: '#64748b' }} />
                      <strong>Output Tokens</strong>
                    </td>
                    <td className="mono">{breakdown.output.toLocaleString()}</td>
                    <td>$0.30 / 1M</td>
                    <td className="mono"><strong>{usage?.cost.tokens.breakdown.output.costMicros.toLocaleString() ?? 0}</strong></td>
                  </tr>

                  <tr>
                    <td>
                      <span className={styles.dotIndicator} style={{ background: '#f59e0b' }} />
                      <strong>Reasoning (o1/o3)</strong>
                    </td>
                    <td className="mono">{breakdown.reasoning.toLocaleString()}</td>
                    <td>$0.30 / 1M</td>
                    <td className="mono"><strong>{usage?.cost.tokens.breakdown.reasoning.costMicros.toLocaleString() ?? 0}</strong></td>
                  </tr>
                </tbody>
              </table>

              <div style={{ background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', fontSize: '0.8rem', color: 'var(--text-body)' }}>
                <strong>Integrity Rule:</strong> Token categories are never summed before pricing. Each token category is priced at its distinct micro-dollar multiplier, guaranteeing accurate billing without float discrepancies.
              </div>
            </div>
          </div>

          {/* Right: Developer API Simulator Console */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5"/>
                    <line x1="12" y1="19" x2="20" y2="19"/>
                  </svg>
                  API Request Simulator
                </div>
                <div className={styles.panelDesc}>
                  Test POST /api/generate with quota boundaries and idempotency keys.
                </div>
              </div>

              {/* Presets */}
              <div className={styles.presetGroup}>
                <button className={styles.presetBtn} onClick={() => applyPreset('chat')}>Chat</button>
                <button className={styles.presetBtn} onClick={() => applyPreset('rag')}>RAG (Cached)</button>
                <button className={styles.presetBtn} onClick={() => applyPreset('reasoning')}>Reasoning</button>
                <button className={styles.presetBtn} onClick={() => applyPreset('stress')}>Quota Stress</button>
              </div>
            </div>

            <div className={styles.panelBody}>
              {/* Form Controls */}
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    <span>Standard Input</span>
                    <span className={styles.formRateTag}>$0.075 / 1M</span>
                  </label>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={inputTokens}
                    onChange={(e) => setInputTokens(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="500"
                    className={styles.rangeSlider}
                    value={inputTokens}
                    onChange={(e) => setInputTokens(parseInt(e.target.value))}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    <span>Cached Input</span>
                    <span className={styles.formRateTag}>$0.01875 / 1M</span>
                  </label>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={cachedInputTokens}
                    onChange={(e) => setCachedInputTokens(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="500"
                    className={styles.rangeSlider}
                    value={cachedInputTokens}
                    onChange={(e) => setCachedInputTokens(parseInt(e.target.value))}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    <span>Output Tokens</span>
                    <span className={styles.formRateTag}>$0.30 / 1M</span>
                  </label>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={outputTokens}
                    onChange={(e) => setOutputTokens(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <input
                    type="range"
                    min="0"
                    max="50000"
                    step="100"
                    className={styles.rangeSlider}
                    value={outputTokens}
                    onChange={(e) => setOutputTokens(parseInt(e.target.value))}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    <span>Reasoning Tokens</span>
                    <span className={styles.formRateTag}>$0.30 / 1M</span>
                  </label>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={reasoningTokens}
                    onChange={(e) => setReasoningTokens(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <input
                    type="range"
                    min="0"
                    max="50000"
                    step="100"
                    className={styles.rangeSlider}
                    value={reasoningTokens}
                    onChange={(e) => setReasoningTokens(parseInt(e.target.value))}
                  />
                </div>
              </div>

              {/* Idempotency Controls */}
              <div className={styles.idempotencyBox}>
                <div className={styles.idempotencyTop}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--black-primary)', textTransform: 'uppercase' }}>
                    Idempotency Key (Header)
                  </span>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={reuseKey}
                      onChange={(e) => setReuseKey(e.target.checked)}
                    />
                    Keep key to test duplicate suppression
                  </label>
                </div>

                <div className={styles.keyInputRow}>
                  <input
                    type="text"
                    className={styles.keyInput}
                    value={idempotencyKey}
                    onChange={(e) => setIdempotencyKey(e.target.value)}
                  />
                  <button className={styles.btnGhost} onClick={handleNewKey}>
                    New Key
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <button
                id="send-generation-btn"
                className={styles.btnBlack}
                onClick={handleSendGeneration}
                disabled={generating || !selectedTenantId}
                style={{ padding: '12px', justifyContent: 'center', width: '100%' }}
              >
                {generating ? 'Processing Ingestion...' : 'Execute Metered API Call (POST /api/generate)'}
              </button>

              {/* Response Console */}
              <div className={styles.responseBox}>
                <div className={styles.responseTopBar}>
                  <span>Console Inspector</span>
                  {genHttpStatus && (
                    <span className={`${styles.responseCodeBadge} ${
                      genHttpStatus === 201 ? styles.code201 :
                      genHttpStatus === 200 ? styles.code200 : styles.code402
                    }`}>
                      HTTP {genHttpStatus} {
                        genHttpStatus === 201 ? 'CREATED' :
                        genHttpStatus === 200 ? 'IDEMPOTENT DUPLICATE' :
                        genHttpStatus === 402 ? 'QUOTA EXCEEDED' : 'FAILED'
                      }
                    </span>
                  )}
                </div>

                {genResponse ? (
                  <div className={styles.responseJson}>
                    {JSON.stringify(genResponse, null, 2)}
                  </div>
                ) : (
                  <div style={{ color: '#71717a', textAlign: 'center', padding: '30px 0' }}>
                    Ready for invocation. Click Execute to observe live metering.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Subscription & Stripe Billing Center */}
        <section className={styles.plansGrid}>
          {/* Free Plan Card */}
          <div className={`${styles.planCard} ${activeTenant?.plan === 'free' ? styles.planCardActive : ''}`}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--black-primary)' }}>Free Developer Tier</h3>
                <span className="badge badge-outline">SANDBOX</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                Default plan for development and local testing.
              </p>

              <div className={styles.planPrice}>
                $0 <span className={styles.planPriceSub}>/ month</span>
              </div>

              <ul className={styles.planFeatures}>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> 1,000 API calls per billing cycle</li>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> 100,000 AI tokens per billing cycle</li>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> Pre-action quota enforcement (402 on boundary)</li>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> Idempotency key tracking</li>
              </ul>
            </div>

            <button
              className={styles.btnGhost}
              disabled={activeTenant?.plan === 'free'}
              style={{ justifyContent: 'center' }}
            >
              {activeTenant?.plan === 'free' ? 'Current Assigned Plan' : 'Select Free'}
            </button>
          </div>

          {/* Pro Plan Card */}
          <div className={`${styles.planCard} ${activeTenant?.plan === 'pro' ? styles.planCardActive : ''}`}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--black-primary)' }}>Production Pro Tier</h3>
                <span className="badge badge-yellow">ENTERPRISE</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                Production quotas with Stripe subscription lifecycle sync.
              </p>

              <div className={styles.planPrice}>
                $29 <span className={styles.planPriceSub}>/ month</span>
              </div>

              <ul className={styles.planFeatures}>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> 50,000 API calls per billing cycle</li>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> 5,000,000 AI tokens per billing cycle</li>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> Stripe Checkout automated provisioning</li>
                <li className={styles.planFeatureItem}><span className={styles.checkMark}>✓</span> Signature-verified webhook synchronization</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                id="upgrade-pro-btn"
                className={styles.btnYellow}
                onClick={handleUpgrade}
                disabled={upgrading || activeTenant?.plan === 'pro'}
                style={{ justifyContent: 'center', padding: '10px' }}
              >
                {activeTenant?.plan === 'pro' ? 'Pro Plan Active' : upgrading ? 'Connecting to Stripe...' : 'Upgrade to Pro via Stripe'}
              </button>

              {checkoutMessage && (
                <div style={{ fontSize: '0.75rem', color: '#854d0e', textAlign: 'center', background: 'var(--yellow-surface)', padding: '6px', borderRadius: '4px' }}>
                  {checkoutMessage}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Create Tenant Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Register New Tenant</h2>
              <button className={styles.modalClose} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--black-primary)' }}>
                  Organization Name
                </label>
                <input
                  id="new-tenant-name-input"
                  type="text"
                  required
                  placeholder="e.g. Stripe Technologies Ltd"
                  className={styles.formInput}
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--black-primary)' }}>
                  Billing Email
                </label>
                <input
                  id="new-tenant-email-input"
                  type="email"
                  placeholder="billing@organization.com"
                  className={styles.formInput}
                  value={newTenantEmail}
                  onChange={(e) => setNewTenantEmail(e.target.value)}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Newly registered tenants inherit Free Developer limits (1,000 calls / 100,000 tokens).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="submit-create-tenant-btn"
                  type="submit"
                  className={styles.btnBlack}
                  disabled={createLoading}
                >
                  {createLoading ? 'Registering...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
