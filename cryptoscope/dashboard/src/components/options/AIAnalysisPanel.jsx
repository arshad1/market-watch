import React from 'react';
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Target, Zap, Clock, DollarSign, BarChart3, Shield, CheckCircle
} from 'lucide-react';

const ProbabilityRing = ({ value }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  const color = value >= 60 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="prob-ring-wrapper">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
        <text x="50" y="50" textAnchor="middle" dy="0.35em" fill={color} fontSize="18" fontWeight="700" fontFamily="Outfit, sans-serif">
          {value}%
        </text>
      </svg>
      <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 4 }}>Win Probability</span>
    </div>
  );
};

const InfoCard = ({ icon: Icon, label, value, color = '#60a5fa', sub }) => (
  <div className="ai-info-card">
    <div className="ai-info-icon" style={{ background: `${color}22`, color }}>
      <Icon size={16} />
    </div>
    <div>
      <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ color, fontWeight: 700, fontSize: '0.95rem' }}>{value}</div>
      {sub && <div style={{ color: '#475569', fontSize: '0.72rem', marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

const AIAnalysisPanel = ({ analysis, loading, error }) => {
  if (loading) {
    return (
      <div className="ai-panel loading">
        <div className="ai-loading-anim">
          <Brain size={32} className="ai-brain-icon" />
          <div style={{ marginTop: 16, color: '#94a3b8', fontFamily: 'Outfit' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 6 }}>AI Analyzing Strategy...</div>
            <div style={{ fontSize: '0.85rem' }}>Fetching historical data, computing probabilities...</div>
          </div>
          <div className="ai-pulse-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-panel error">
        <AlertTriangle size={24} style={{ color: '#f59e0b', marginBottom: 12 }} />
        <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: 8 }}>Analysis Unavailable</div>
        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{error}</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="ai-panel empty">
        <Brain size={40} style={{ color: 'rgba(99,179,237,0.3)', marginBottom: 16 }} />
        <div style={{ color: '#475569', fontFamily: 'Outfit', fontSize: '1rem', fontWeight: 600 }}>
          AI Analysis Ready
        </div>
        <div style={{ color: '#374151', fontSize: '0.85rem', marginTop: 8 }}>
          Configure your strategy legs and click "Analyze with AI" to get a full risk report.
        </div>
      </div>
    );
  }

  const pop = analysis.probability_of_profit || 50;
  const recColor = {
    'Strong Buy': '#10b981', 'Buy': '#34d399', 'Hold': '#f59e0b',
    'Avoid': '#f87171', 'Strong Avoid': '#ef4444'
  }[analysis.recommendation] || '#94a3b8';

  const biasIcon = {
    'Bullish': <TrendingUp size={14} />,
    'Bearish': <TrendingDown size={14} />,
    'Neutral': <Minus size={14} />
  }[analysis.market_alignment] || <Minus size={14} />;

  return (
    <div className="ai-panel active animate-fade-in">
      {/* Header */}
      <div className="ai-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ai-logo-badge">
            <Brain size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontFamily: 'Outfit', fontSize: '1rem' }}>AI Strategy Analysis</div>
            <div style={{ color: '#475569', fontSize: '0.75rem' }}>Powered by DeepSeek</div>
          </div>
        </div>
        <div style={{
          background: `${recColor}22`,
          color: recColor,
          border: `1px solid ${recColor}44`,
          padding: '6px 14px',
          borderRadius: 999,
          fontSize: '0.8rem',
          fontWeight: 700
        }}>
          {analysis.recommendation || 'Neutral'}
        </div>
      </div>

      {/* Top section: ring + key metrics */}
      <div className="ai-top-grid">
        <ProbabilityRing value={Math.round(pop)} />
        <div className="ai-metrics-grid">
          <InfoCard icon={DollarSign} label="Max Profit" value={analysis.max_profit > 1e7 ? '∞' : `$${(analysis.max_profit || 0).toLocaleString()}`} color="#10b981" />
          <InfoCard icon={Shield} label="Max Loss" value={analysis.max_loss < -1e7 ? '-∞' : `$${Math.abs(analysis.max_loss || 0).toLocaleString()}`} color="#ef4444" />
          <InfoCard icon={DollarSign} label="Fund Required" value={`$${(analysis.fund_required || 0).toLocaleString()}`} color="#60a5fa" sub={analysis.fund_flow} />
          <InfoCard icon={BarChart3} label="Confidence" value={analysis.confidence_level || 'Medium'} color="#a78bfa" />
          <InfoCard icon={biasIcon.type || Target} label="Market Bias" value={analysis.market_alignment || 'Neutral'} color="#f59e0b" />
          <InfoCard icon={Clock} label="Best Window" value={analysis.ideal_entry_window || 'Now'} color="#38bdf8" />
        </div>
      </div>

      {/* Recommendation reason */}
      {analysis.recommendation_reason && (
        <div className="ai-section">
          <div className="ai-section-title"><Zap size={14} /> AI Assessment</div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>
            {analysis.recommendation_reason}
          </p>
        </div>
      )}

      {/* Web strategy insights */}
      {analysis.web_strategy_insights && (
        <div className="ai-section">
          <div className="ai-section-title"><TrendingUp size={14} /> Web Strategy Insights</div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>
            {analysis.web_strategy_insights}
          </p>
        </div>
      )}

      {/* Breakeven points */}
      {analysis.breakeven_points?.length > 0 && (
        <div className="ai-section">
          <div className="ai-section-title"><Target size={14} /> Breakeven Points</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {analysis.breakeven_points.map((bp, i) => (
              <div key={i} style={{
                background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                color: '#fbbf24', padding: '4px 12px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600
              }}>
                ${bp?.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key risks */}
      {analysis.key_risks?.length > 0 && (
        <div className="ai-section">
          <div className="ai-section-title"><AlertTriangle size={14} /> Key Risks</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analysis.key_risks.map((risk, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#94a3b8', fontSize: '0.85rem' }}>
                <span style={{ color: '#ef4444', marginTop: 2, flexShrink: 0 }}>•</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strategy tips */}
      {analysis.strategy_tips?.length > 0 && (
        <div className="ai-section">
          <div className="ai-section-title"><CheckCircle size={14} /> Strategy Tips</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analysis.strategy_tips.map((tip, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#94a3b8', fontSize: '0.85rem' }}>
                <span style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }}>✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exit Plan */}
      {analysis.exit_plan && (
        <div className="ai-section">
          <div className="ai-section-title"><Target size={14} /> Exit Plan</div>
          <div className="exit-plan-grid">
            <div className="exit-item profit">
              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>PROFIT TARGET</span>
              <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>{analysis.exit_plan.profit_target}</span>
            </div>
            <div className="exit-item loss">
              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>STOP LOSS</span>
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>{analysis.exit_plan.stop_loss}</span>
            </div>
            <div className="exit-item time">
              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>TIME EXIT</span>
              <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600 }}>{analysis.exit_plan.time_exit}</span>
            </div>
          </div>
        </div>
      )}

      {/* Alternative strategies */}
      {analysis.alternative_strategies?.length > 0 && (
        <div className="ai-section">
          <div className="ai-section-title"><BarChart3 size={14} /> Consider Instead</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {analysis.alternative_strategies.map((alt, i) => (
              <div key={i} style={{
                background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.2)',
                color: '#7dd3fc', padding: '4px 12px', borderRadius: 999, fontSize: '0.8rem'
              }}>
                {alt}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backtesting badge */}
      {analysis.strategy_meta && (
        <div className="ai-backtest-badge">
          <BarChart3 size={12} />
          Historical: <strong style={{ color: '#7dd3fc' }}>
            {analysis.strategy_meta.backtested_matches} similar setups
          </strong> found · Avg win rate: <strong style={{ color: '#34d399' }}>
            {analysis.strategy_meta.backtested_win_rate}%
          </strong>
        </div>
      )}

      {/* Disclaimer */}
      <div className="ai-disclaimer">
        {analysis.disclaimer}
      </div>
    </div>
  );
};

export default AIAnalysisPanel;
