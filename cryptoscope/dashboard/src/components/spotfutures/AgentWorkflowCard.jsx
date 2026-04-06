import React from 'react';
import { Bot, Activity, Shield, GitBranch, AlertTriangle, Waves } from 'lucide-react';

const toneColor = (value) => {
  switch (value) {
    case 'BUY':
    case 'Bullish':
      return '#10b981';
    case 'SELL':
    case 'Bearish':
      return '#ef4444';
    case 'HIGH':
      return '#f59e0b';
    default:
      return '#94a3b8';
  }
};

const AgentWorkflowCard = ({ workflow }) => {
  if (!workflow) return null;

  const { screening, agents, shock_flags: shockFlags, triggered_dynamic_context: triggeredDynamicContext, context } = workflow;
  const cards = [
    {
      title: 'Screening Agent',
      icon: Bot,
      badge: screening?.bias || 'HOLD',
      body: screening?.why || 'No screening rationale returned.',
      meta: screening?.market_regime || 'Unknown regime'
    },
    {
      title: 'Technical Analyst',
      icon: Activity,
      badge: agents?.technical_analysis?.trade_bias || 'HOLD',
      body: agents?.technical_analysis?.analyst_note || 'No technical note returned.',
      meta: `${agents?.technical_analysis?.trend || 'Unknown trend'} · ${agents?.technical_analysis?.momentum || 'Unknown momentum'}`
    },
    {
      title: 'Sentiment Analyst',
      icon: GitBranch,
      badge: agents?.sentiment_analysis?.sentiment_bias || 'Neutral',
      body: agents?.sentiment_analysis?.analyst_note || 'No sentiment note returned.',
      meta: agents?.sentiment_analysis?.conviction || 'No conviction score'
    },
    {
      title: 'Order Flow Analyst',
      icon: Waves,
      badge: agents?.orderflow_analysis?.flow_bias || 'Neutral',
      body: agents?.orderflow_analysis?.analyst_note || 'No order flow note returned.',
      meta: `${agents?.orderflow_analysis?.execution_quality || 'Unknown quality'} · ${agents?.orderflow_analysis?.liquidity_state || 'Unknown liquidity'}`
    },
    {
      title: 'Risk Manager',
      icon: Shield,
      badge: agents?.risk_review?.approved ? 'APPROVED' : 'CHECK',
      body: Array.isArray(agents?.risk_review?.blocking_reasons) && agents.risk_review.blocking_reasons.length
        ? agents.risk_review.blocking_reasons.join(' ')
        : (agents?.risk_review?.execution_guidance || 'No risk guidance returned.'),
      meta: agents?.risk_review?.leverage_cap || 'No leverage cap'
    }
  ];

  return (
    <div className="glass-card sfa-agentic-card">
      <div className="sfa-card-title">
        <Bot size={15} /> Agentic Workflow
      </div>

      <div className="agentic-topline">
        <div className={`agentic-flag ${triggeredDynamicContext ? 'hot' : ''}`}>
          <AlertTriangle size={14} />
          {triggeredDynamicContext ? 'Dynamic context expansion triggered' : 'Base context was sufficient'}
        </div>
        <div className="agentic-meta">
          Headlines used: {context?.news_headlines_used || 0}
        </div>
      </div>

      <div className="agentic-shocks">
        <span className={`shock-pill ${shockFlags?.priceShock ? 'active' : ''}`}>Price Shock</span>
        <span className={`shock-pill ${shockFlags?.orderFlowShock ? 'active' : ''}`}>Order Flow Shock</span>
        <span className={`shock-pill ${shockFlags?.volatilityShock ? 'active' : ''}`}>Volatility Shock</span>
      </div>

      <div className="agentic-grid">
        {cards.map(({ title, icon: Icon, badge, body, meta }) => (
          <div key={title} className="agentic-step">
            <div className="agentic-step-head">
              <div className="agentic-step-title"><Icon size={14} /> {title}</div>
              <span className="agentic-badge" style={{ color: toneColor(badge), borderColor: `${toneColor(badge)}55`, background: `${toneColor(badge)}12` }}>
                {badge}
              </span>
            </div>
            <div className="agentic-step-meta">{meta}</div>
            <p className="agentic-step-body">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentWorkflowCard;
