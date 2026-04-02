import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Sparkles, RefreshCw, BookOpen, Zap, TrendingUp,
  TrendingDown, Minus, ChevronRight, Layers
} from 'lucide-react';
import PayoffChart from './PayoffChart';
import StrategyLeg from './StrategyLeg';
import AIAnalysisPanel from './AIAnalysisPanel';

// Strategy templates with pre-built legs relative to current price
const STRATEGY_TEMPLATES = [
  {
    id: 'long_call',
    name: 'Long Call',
    emoji: '📈',
    bias: 'Bullish',
    type: 'Debit',
    pop: '~35%',
    capital: 'Low',
    color: '#10b981',
    description: 'Unlimited upside, limited downside. Best for strong bullish conviction.',
    buildLegs: (price) => [{
      type: 'Call', direction: 'Buy',
      strike: Math.round(price * 1.02 / 100) * 100,
      premium: Math.round(price * 0.02 * 100) / 100,
      quantity: 1, expiry: '7 days'
    }]
  },
  {
    id: 'long_put',
    name: 'Long Put',
    emoji: '📉',
    bias: 'Bearish',
    type: 'Debit',
    pop: '~32%',
    capital: 'Low',
    color: '#ef4444',
    description: 'Profit from a decline. Simple and defined-risk bearish strategy.',
    buildLegs: (price) => [{
      type: 'Put', direction: 'Buy',
      strike: Math.round(price * 0.98 / 100) * 100,
      premium: Math.round(price * 0.02 * 100) / 100,
      quantity: 1, expiry: '7 days'
    }]
  },
  {
    id: 'bull_call_spread',
    name: 'Bull Call Spread',
    emoji: '🟢',
    bias: 'Bullish',
    type: 'Debit',
    pop: '~48%',
    capital: 'Medium',
    color: '#34d399',
    description: 'Lower cost bullish play with capped gain. Good risk-reward ratio.',
    buildLegs: (price) => [
      { type: 'Call', direction: 'Buy', strike: Math.round(price / 100) * 100, premium: Math.round(price * 0.025 * 100) / 100, quantity: 1, expiry: '14 days' },
      { type: 'Call', direction: 'Sell', strike: Math.round(price * 1.05 / 100) * 100, premium: Math.round(price * 0.01 * 100) / 100, quantity: 1, expiry: '14 days' }
    ]
  },
  {
    id: 'bear_put_spread',
    name: 'Bear Put Spread',
    emoji: '🔴',
    bias: 'Bearish',
    type: 'Debit',
    pop: '~45%',
    capital: 'Medium',
    color: '#f87171',
    description: 'Defined-risk bearish strategy with reduced cost vs long put.',
    buildLegs: (price) => [
      { type: 'Put', direction: 'Buy', strike: Math.round(price / 100) * 100, premium: Math.round(price * 0.025 * 100) / 100, quantity: 1, expiry: '14 days' },
      { type: 'Put', direction: 'Sell', strike: Math.round(price * 0.95 / 100) * 100, premium: Math.round(price * 0.01 * 100) / 100, quantity: 1, expiry: '14 days' }
    ]
  },
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    emoji: '🦅',
    bias: 'Neutral',
    type: 'Credit',
    pop: '~72%',
    capital: 'High',
    color: '#a78bfa',
    description: 'High probability income strategy. Profits if price stays in a range.',
    buildLegs: (price) => [
      { type: 'Put', direction: 'Buy', strike: Math.round(price * 0.90 / 100) * 100, premium: Math.round(price * 0.005 * 100) / 100, quantity: 1, expiry: '14 days' },
      { type: 'Put', direction: 'Sell', strike: Math.round(price * 0.94 / 100) * 100, premium: Math.round(price * 0.012 * 100) / 100, quantity: 1, expiry: '14 days' },
      { type: 'Call', direction: 'Sell', strike: Math.round(price * 1.06 / 100) * 100, premium: Math.round(price * 0.012 * 100) / 100, quantity: 1, expiry: '14 days' },
      { type: 'Call', direction: 'Buy', strike: Math.round(price * 1.10 / 100) * 100, premium: Math.round(price * 0.005 * 100) / 100, quantity: 1, expiry: '14 days' }
    ]
  },
  {
    id: 'straddle',
    name: 'Long Straddle',
    emoji: '⚡',
    bias: 'Volatile',
    type: 'Debit',
    pop: '~38%',
    capital: 'Medium',
    color: '#fbbf24',
    description: 'Bets on a big move. Profits if price swings hard in any direction.',
    buildLegs: (price) => [
      { type: 'Call', direction: 'Buy', strike: Math.round(price / 100) * 100, premium: Math.round(price * 0.025 * 100) / 100, quantity: 1, expiry: '7 days' },
      { type: 'Put', direction: 'Buy', strike: Math.round(price / 100) * 100, premium: Math.round(price * 0.025 * 100) / 100, quantity: 1, expiry: '7 days' }
    ]
  },
  {
    id: 'covered_call',
    name: 'Covered Call',
    emoji: '🛡️',
    bias: 'Neutral/Bullish',
    type: 'Credit',
    pop: '~68%',
    capital: 'Very High',
    color: '#60a5fa',
    description: 'Generate income from holdings. Sell a call against your existing position.',
    buildLegs: (price) => [
      { type: 'Call', direction: 'Sell', strike: Math.round(price * 1.04 / 100) * 100, premium: Math.round(price * 0.015 * 100) / 100, quantity: 1, expiry: '14 days' }
    ]
  },
  {
    id: 'strangle',
    name: 'Long Strangle',
    emoji: '🌊',
    bias: 'Volatile',
    type: 'Debit',
    pop: '~30%',
    capital: 'Low',
    color: '#fb923c',
    description: 'Cheaper than straddle, needs a bigger move to profit. High volatility bet.',
    buildLegs: (price) => [
      { type: 'Call', direction: 'Buy', strike: Math.round(price * 1.04 / 100) * 100, premium: Math.round(price * 0.015 * 100) / 100, quantity: 1, expiry: '7 days' },
      { type: 'Put', direction: 'Buy', strike: Math.round(price * 0.96 / 100) * 100, premium: Math.round(price * 0.015 * 100) / 100, quantity: 1, expiry: '7 days' }
    ]
  }
];

const BIAS_ICON = {
  'Bullish': <TrendingUp size={12} />,
  'Bearish': <TrendingDown size={12} />,
  'Neutral': <Minus size={12} />,
  'Volatile': <Zap size={12} />,
  'Neutral/Bullish': <TrendingUp size={12} />
};

const defaultMarketData = {
  asset: 'BTC/USDT',
  price: 65000,
  changePct: 1.2,
  rsi: 55,
  macd: 120,
  macdSignal: 95,
  sentiment: 'Neutral'
};

const StrategyBuilder = () => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [legs, setLegs] = useState([]);
  const [marketData, setMarketData] = useState(defaultMarketData);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'templates'

  // Fetch latest market data from the briefs API to get real price/indicators
  useEffect(() => {
    fetch('/api/briefs?limit=1')
      .then(r => r.json())
      .then(data => {
        if (data.briefs?.length > 0) {
          const brief = data.briefs[0];
          if (brief.price) setMarketData(prev => ({ ...prev, price: parseFloat(brief.price) || prev.price, asset: brief.asset || prev.asset }));
        }
      })
      .catch(() => {});
  }, []);

  const applyTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setLegs(template.buildLegs(marketData.price));
    setAnalysis(null);
    setAnalyzeError(null);
    setActiveTab('builder');
  }, [marketData.price]);

  const addLeg = () => {
    setLegs(prev => [...prev, {
      type: 'Call', direction: 'Buy',
      strike: Math.round(marketData.price / 100) * 100,
      premium: 0, quantity: 1, expiry: '7 days'
    }]);
  };

  const updateLeg = (index, newLeg) => {
    setLegs(prev => prev.map((l, i) => i === index ? newLeg : l));
  };

  const removeLeg = (index) => {
    setLegs(prev => prev.filter((_, i) => i !== index));
  };

  const runAnalysis = async () => {
    if (legs.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);

    try {
      const res = await fetch('/api/options/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: selectedTemplate?.id || 'custom',
          legs,
          marketData
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (err) {
      setAnalyzeError(err.message || 'Analysis failed. Check your API key and server config.');
    } finally {
      setAnalyzing(false);
    }
  };

  const netPremium = legs.reduce((sum, leg) => {
    const mult = leg.direction === 'Buy' ? -1 : 1;
    return sum + mult * (parseFloat(leg.premium) || 0) * (leg.quantity || 1);
  }, 0);

  return (
    <div className="strategy-builder">
      {/* ── Page header ── */}
      <div className="sb-header">
        <div>
          <h2 className="sb-title">
            <Layers size={22} className="sb-title-icon" /> Option Strategy Builder
          </h2>
          <p className="sb-subtitle">Build, visualize & analyze multi-leg option strategies with AI</p>
        </div>
        <div className="sb-market-pill">
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Underlying</span>
          <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{marketData.asset}</strong>
          <strong style={{ color: '#10b981' }}>${marketData.price.toLocaleString()}</strong>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="sb-tabs">
        <button className={`sb-tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
          <BookOpen size={15} /> Strategy Library
        </button>
        <button className={`sb-tab ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}>
          <Layers size={15} /> Leg Builder
        </button>
      </div>

      {/* ── Template Library ── */}
      {activeTab === 'templates' && (
        <div className="template-grid animate-fade-in">
          {STRATEGY_TEMPLATES.map(tmpl => (
            <div
              key={tmpl.id}
              className={`template-card ${selectedTemplate?.id === tmpl.id ? 'selected' : ''}`}
              style={{ '--tmpl-color': tmpl.color }}
              onClick={() => applyTemplate(tmpl)}
            >
              <div className="tmpl-top">
                <span className="tmpl-emoji">{tmpl.emoji}</span>
                <div>
                  <div className="tmpl-name">{tmpl.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span className="tmpl-badge" style={{ background: `${tmpl.color}22`, color: tmpl.color, border: `1px solid ${tmpl.color}33` }}>
                      {BIAS_ICON[tmpl.bias]} {tmpl.bias}
                    </span>
                    <span className="tmpl-badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {tmpl.type}
                    </span>
                  </div>
                </div>
              </div>
              <p className="tmpl-desc">{tmpl.description}</p>
              <div className="tmpl-stats">
                <div>
                  <span style={{ color: '#475569', fontSize: '0.7rem' }}>WIN RATE</span>
                  <span style={{ color: tmpl.color, fontWeight: 700, fontSize: '0.9rem' }}>{tmpl.pop}</span>
                </div>
                <div>
                  <span style={{ color: '#475569', fontSize: '0.7rem' }}>CAPITAL</span>
                  <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem' }}>{tmpl.capital}</span>
                </div>
                <button className="tmpl-apply-btn" style={{ color: tmpl.color, border: `1px solid ${tmpl.color}44` }}>
                  Use <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Leg Builder ── */}
      {activeTab === 'builder' && (
        <div className="sb-builder-layout animate-fade-in">
          {/* LEFT: legs + payoff chart */}
          <div className="sb-left">
            {/* Market data override */}
            <div className="sb-market-inputs glass-card" style={{ marginBottom: 16 }}>
              <div className="sb-section-label">Market Context</div>
              <div className="market-inputs-row">
                <div className="mi-field">
                  <label>Asset</label>
                  <input className="leg-input" value={marketData.asset} onChange={e => setMarketData(p => ({ ...p, asset: e.target.value }))} />
                </div>
                <div className="mi-field">
                  <label>Current Price ($)</label>
                  <input type="number" className="leg-input" value={marketData.price} onChange={e => setMarketData(p => ({ ...p, price: parseFloat(e.target.value) || p.price }))} />
                </div>
                <div className="mi-field">
                  <label>24H Change (%)</label>
                  <input type="number" className="leg-input" value={marketData.changePct} onChange={e => setMarketData(p => ({ ...p, changePct: parseFloat(e.target.value) }))} />
                </div>
                <div className="mi-field">
                  <label>RSI(14)</label>
                  <input type="number" className="leg-input" value={marketData.rsi} onChange={e => setMarketData(p => ({ ...p, rsi: parseFloat(e.target.value) }))} />
                </div>
              </div>
            </div>

            {/* Selected template banner */}
            {selectedTemplate && (
              <div className="template-banner" style={{ borderColor: `${selectedTemplate.color}44`, background: `${selectedTemplate.color}11` }}>
                <span style={{ fontSize: '1.2rem' }}>{selectedTemplate.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, color: selectedTemplate.color, fontSize: '0.9rem' }}>{selectedTemplate.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{selectedTemplate.description}</div>
                </div>
                <button className="tmpl-change-btn" onClick={() => setActiveTab('templates')}>Change</button>
              </div>
            )}

            {/* Legs list */}
            <div className="sb-section-label" style={{ marginBottom: 10 }}>
              Strategy Legs
              <span style={{ background: 'rgba(99,179,237,0.15)', color: '#7dd3fc', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', marginLeft: 8 }}>
                {legs.length} leg{legs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {legs.length === 0 ? (
              <div className="legs-empty">
                <Layers size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                <span>No legs yet. Pick a template or add legs manually.</span>
              </div>
            ) : (
              <div className="legs-list">
                {legs.map((leg, i) => (
                  <StrategyLeg
                    key={i}
                    leg={leg}
                    index={i}
                    currentPrice={marketData.price}
                    onUpdate={updateLeg}
                    onRemove={removeLeg}
                  />
                ))}
              </div>
            )}

            {/* Add leg + Net premium row */}
            <div className="sb-actions-row">
              <button className="add-leg-btn" onClick={addLeg}>
                <Plus size={15} /> Add Leg
              </button>
              {legs.length > 0 && (
                <div className="net-credit-badge" style={{ color: netPremium >= 0 ? '#10b981' : '#ef4444', background: netPremium >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${netPremium >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                  Net {netPremium >= 0 ? 'Credit' : 'Debit'}: <strong>{netPremium >= 0 ? '+' : ''}${Math.abs(netPremium).toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Payoff Chart */}
            <div className="glass-card" style={{ marginTop: 16 }}>
              <div className="sb-section-label" style={{ marginBottom: 12 }}>Payoff at Expiration</div>
              <PayoffChart legs={legs} currentPrice={marketData.price} />
            </div>

            {/* Analyze button */}
            <button
              className={`analyze-btn ${analyzing ? 'analyzing' : ''}`}
              onClick={runAnalysis}
              disabled={analyzing || legs.length === 0}
            >
              {analyzing ? (
                <><RefreshCw size={16} className="spinning" /> Analyzing with AI...</>
              ) : (
                <><Sparkles size={16} /> Analyze with AI</>
              )}
            </button>
          </div>

          {/* RIGHT: AI analysis */}
          <div className="sb-right">
            <AIAnalysisPanel analysis={analysis} loading={analyzing} error={analyzeError} />
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyBuilder;
