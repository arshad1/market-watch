import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight, DollarSign, Clock, BarChart2 } from 'lucide-react';

const VERDICT_CONFIG = {
  BUY:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: TrendingUp,  label: 'BUY',  gradient: 'linear-gradient(135deg, #059669, #10b981)' },
  SELL: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   icon: TrendingDown, label: 'SELL', gradient: 'linear-gradient(135deg, #b91c1c, #ef4444)' },
  HOLD: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',  icon: Minus,       label: 'HOLD', gradient: 'linear-gradient(135deg, #b45309, #f59e0b)' },
};

const MOMENTUM_COLOR = {
  'Strong Bullish': '#10b981', 'Bullish': '#34d399',
  'Neutral': '#94a3b8', 'Bearish': '#f87171', 'Strong Bearish': '#ef4444'
};

const StatBox = ({ label, value, color = '#60a5fa', sub }) => (
  <div className="verdict-stat">
    <div className="verdict-stat-label">{label}</div>
    <div className="verdict-stat-value" style={{ color }}>{value}</div>
    {sub && <div className="verdict-stat-sub">{sub}</div>}
  </div>
);

const VerdictCard = ({ analysis, asset, timeframe }) => {
  const v = VERDICT_CONFIG[analysis.final_verdict] || VERDICT_CONFIG.HOLD;
  const Icon = v.icon;
  const confidence = analysis.confidence_score || 50;
  const circum = 2 * Math.PI * 30;
  const dashOffset = circum - (confidence / 100) * circum;

  return (
    <div className="verdict-card glass-card" style={{ borderColor: v.border }}>
      {/* Glowing accent top bar */}
      <div className="verdict-top-bar" style={{ background: v.gradient }} />

      <div className="verdict-body">
        {/* LEFT: Big verdict */}
        <div className="verdict-left">
          <div className="verdict-badge" style={{ background: v.bg, border: `1px solid ${v.border}` }}>
            <Icon size={20} color={v.color} />
          </div>
          <div className="verdict-label" style={{ color: v.color }}>
            {analysis.verdict_strength} {v.label}
          </div>
          <div className="verdict-asset-row">
            <span className="verdict-asset">{asset}</span>
            <span className="verdict-tf">{timeframe}</span>
          </div>
          <div className="verdict-trade-type" style={{ color: v.color, background: v.bg, border: `1px solid ${v.border}` }}>
            {analysis.trade_type}
          </div>
          <div className="verdict-price-row">
            ${analysis.price?.toLocaleString()}
          </div>
        </div>

        {/* CENTER: Confidence ring */}
        <div className="verdict-center">
          <div className="verdict-ring-wrap">
            <svg width="90" height="90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
              <circle
                cx="40" cy="40" r="30" fill="none"
                stroke={v.color} strokeWidth="7"
                strokeDasharray={circum}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 1.2s ease' }}
              />
              <text x="40" y="40" textAnchor="middle" dy="0.35em" fill={v.color} fontSize="16" fontWeight="700" fontFamily="Outfit, sans-serif">
                {confidence}%
              </text>
            </svg>
            <div style={{ color: '#475569', fontSize: '0.72rem', textAlign: 'center', marginTop: 6 }}>AI Confidence</div>
          </div>

          {/* Trend + Momentum + Volatility */}
          <div className="verdict-meta-pills">
            <div className="verdict-pill neutral">📈 {analysis.trend}</div>
            <div className="verdict-pill" style={{ color: MOMENTUM_COLOR[analysis.momentum] || '#94a3b8', background: `${MOMENTUM_COLOR[analysis.momentum]}18` || 'rgba(148,163,184,0.1)' }}>
              ⚡ {analysis.momentum}
            </div>
            <div className="verdict-pill neutral">🌊 {analysis.volatility} Vol</div>
          </div>
        </div>

        {/* RIGHT: Trade parameters */}
        <div className="verdict-right">
          <div className="trade-param-grid">
            <StatBox label="Entry Zone"
              value={analysis.entry_zone
                ? `$${analysis.entry_zone.low?.toLocaleString()} – $${analysis.entry_zone.high?.toLocaleString()}`
                : '—'}
              color="#60a5fa"
            />
            <StatBox label="Stop Loss" value={`$${analysis.stop_loss?.toLocaleString()}`} color="#ef4444" />
            <StatBox label="Take Profit 1" value={`$${analysis.take_profit_1?.toLocaleString()}`} color="#10b981" />
            <StatBox label="Take Profit 2" value={`$${analysis.take_profit_2?.toLocaleString()}`} color="#34d399" />
            <StatBox label="Take Profit 3" value={`$${analysis.take_profit_3?.toLocaleString()}`} color="#6ee7b7" />
            <StatBox label="Risk : Reward" value={analysis.risk_reward_ratio} color="#a78bfa" />
            <StatBox label="Suggested Leverage" value={analysis.suggested_leverage || 'N/A'} color="#fbbf24" />
            <StatBox label="Hold Duration" value={analysis.hold_duration} color="#38bdf8" />
          </div>
        </div>
      </div>

      {/* Market summary */}
      {analysis.market_summary && (
        <div className="verdict-summary">
          <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Market Summary
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>
            {analysis.market_summary}
          </p>
        </div>
      )}
    </div>
  );
};

export default VerdictCard;
