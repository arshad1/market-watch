import React, { useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Zap,
  AlertTriangle, Target, Clock, BarChart2, Activity,
  Shield, DollarSign, ChevronDown, Layers, Globe
} from 'lucide-react';
import VerdictCard from './VerdictCard';
import StrategySignals from './StrategySignals';
import IndicatorGrid from './IndicatorGrid';

const ASSETS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
  'XRP/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOGE/USDT',
  'MATIC/USDT', 'LINK/USDT', 'DOT/USDT', 'TRX/USDT'
];

const TIMEFRAMES = [
  { label: '5m Scalp', value: '5m' },
  { label: '15m Swing', value: '15m' },
  { label: '1H Position', value: '1h' },
  { label: '4H Trend', value: '4h' },
];

const SpotFuturesAnalyzer = ({ token }) => {
  const [asset, setAsset]         = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('15m');
  const [analysis, setAnalysis]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastRun, setLastRun]     = useState(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/spot-futures/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ asset, timeframe })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
      setLastRun(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [asset, timeframe]);

  const verdictColor = {
    BUY:  '#10b981', SELL: '#ef4444', HOLD: '#f59e0b'
  }[analysis?.final_verdict] || '#94a3b8';

  return (
    <div className="sfa-page">
      {/* ── Page Header ── */}
      <div className="sfa-header">
        <div>
          <h2 className="sfa-title">
            <Globe size={22} className="sfa-icon" />
            Spot &amp; Futures Strategy Analyzer
          </h2>
          <p className="sfa-subtitle">
            9 real-world strategies incl. SMC + ICT · Live Binance data · AI-powered BUY / SELL verdict
          </p>
        </div>

        {lastRun && (
          <div className="sfa-last-run">
            <Clock size={12} />
            Last run: {lastRun.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="sfa-controls glass-card">
        {/* Asset selector */}
        <div className="sfa-control-group">
          <label className="sfa-label">Asset</label>
          <div className="sfa-select-wrap">
            <select
              className="sfa-select"
              value={asset}
              onChange={e => { setAsset(e.target.value); setAnalysis(null); }}
              id="sfa-asset-select"
            >
              {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown size={14} className="sfa-select-icon" />
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="sfa-control-group">
          <label className="sfa-label">Timeframe</label>
          <div className="sfa-tf-group">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                className={`sfa-tf-btn ${timeframe === tf.value ? 'active' : ''}`}
                onClick={() => { setTimeframe(tf.value); setAnalysis(null); }}
                id={`sfa-tf-${tf.value}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          id="sfa-analyze-btn"
          className={`sfa-run-btn ${loading ? 'loading' : ''}`}
          onClick={runAnalysis}
          disabled={loading}
        >
          {loading ? (
            <><RefreshCw size={16} className="spinning" /> Analyzing Market...</>
          ) : (
            <><Zap size={16} /> Analyze Now</>
          )}
        </button>
      </div>

      {/* ── Error State ── */}
      {error && (
        <div className="sfa-error">
          <AlertTriangle size={18} />
          <span><strong>Error:</strong> {error}</span>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="sfa-loading-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="sfa-skeleton glass-card">
              <div className="skeleton-line tall" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {analysis && !loading && (
        <div className="sfa-results animate-fade-in">
          {/* Main verdict + market summary */}
          <VerdictCard analysis={analysis} asset={asset} timeframe={timeframe} />

          {/* Strategy signals scoreboard */}
          <StrategySignals signals={analysis.strategy_signals} />

          {/* Live indicators grid */}
          {analysis.live_indicators && (
            <IndicatorGrid indicators={analysis.live_indicators} />
          )}

          {/* Levels + Risks + Analyst Opinion */}
          <div className="sfa-bottom-grid">
            {/* Key levels */}
            <div className="glass-card sfa-levels-card">
              <div className="sfa-card-title"><Target size={15} /> Key Levels</div>
              <div className="sfa-levels-section">
                <div className="levels-group">
                  <div className="levels-group-label resistance">Resistance</div>
                  {(analysis.key_resistance_levels || []).map((lvl, i) => (
                    <div key={i} className="level-item resistance">
                      <span className="level-badge r">R{i + 1}</span>
                      <span>${lvl?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: 'var(--border-card)', margin: '12px 0' }} />
                <div className="levels-group">
                  <div className="levels-group-label support">Support</div>
                  {(analysis.key_support_levels || []).map((lvl, i) => (
                    <div key={i} className="level-item support">
                      <span className="level-badge s">S{i + 1}</span>
                      <span>${lvl?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Key risks */}
            <div className="glass-card sfa-risks-card">
              <div className="sfa-card-title"><Shield size={15} /> Key Risks</div>
              <ul className="risk-list">
                {(analysis.key_risks || []).map((risk, i) => (
                  <li key={i} className="risk-item">
                    <span className="risk-dot">⚠</span>
                    {risk}
                  </li>
                ))}
              </ul>
              {analysis.news_impact && (
                <div className="news-impact-box">
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>News Impact</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>{analysis.news_impact}</div>
                </div>
              )}
            </div>

            {/* Analyst opinion */}
            <div className="glass-card sfa-opinion-card">
              <div className="sfa-card-title"><Activity size={15} /> AI Analyst Opinion</div>
              <div className="opinion-avatar">
                <div className="opinion-avatar-icon">AI</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>CryptoScope AI</div>
                  <div style={{ color: '#475569', fontSize: '0.75rem' }}>Quantitative Analyst</div>
                </div>
              </div>
              <blockquote className="opinion-text">
                "{analysis.analyst_opinion}"
              </blockquote>
              <div style={{ color: '#374151', fontSize: '0.72rem', marginTop: 12, lineHeight: 1.5 }}>
                {analysis.disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!analysis && !loading && !error && (
        <div className="sfa-empty">
          <BarChart2 size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <h3 style={{ fontFamily: 'Outfit', color: '#374151', marginBottom: 8 }}>No Analysis Yet</h3>
          <p style={{ color: '#374151', fontSize: '0.875rem' }}>
            Select an asset and timeframe, then click <strong style={{ color: '#60a5fa' }}>Analyze Now</strong> to run the 7-strategy evaluation.
          </p>
        </div>
      )}
    </div>
  );
};

export default SpotFuturesAnalyzer;
