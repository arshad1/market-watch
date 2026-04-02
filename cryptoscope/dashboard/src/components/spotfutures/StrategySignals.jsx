import React from 'react';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StrategySignals = ({ signals }) => {
  if (!signals || signals.length === 0) return null;

  const getSignalMeta = (signal) => {
    switch (signal) {
      case 'BUY':
        return { color: '#10b981', icon: TrendingUp };
      case 'SELL':
        return { color: '#ef4444', icon: TrendingDown };
      default:
        return { color: '#94a3b8', icon: Minus };
    }
  };

  return (
    <div className="glass-card sfa-signals">
      <div className="sfa-card-title">
        <Target size={15} /> Multi-Strategy Signal Evaluation
      </div>
      <div className="signal-list">
        {signals.map((sig, i) => {
          const meta = getSignalMeta(sig.signal);
          const Icon = meta.icon;
          return (
            <div key={i} className="signal-item">
              <div className="signal-left">
                <div className="signal-name">{sig.strategy}</div>
                <div className="signal-winrate">Historical Win Rate: {sig.win_rate}</div>
                <div className="signal-reason">{sig.reason}</div>
              </div>
              <div className="signal-right">
                <div className="signal-score" style={{ color: meta.color }}>
                  <Icon size={14} style={{ marginRight: 4 }} />
                  {sig.signal}
                </div>
                <div className="signal-score-val">Score: {sig.score}/10</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StrategySignals;
