import React from 'react';
import { Activity } from 'lucide-react';

const IndicatorGrid = ({ indicators }) => {
  if (!indicators) return null;

  return (
    <div className="glass-card sfa-indicators">
      <div className="sfa-card-title">
        <Activity size={15} /> Live Technical Indicators
      </div>
      <div className="indicator-grid">
        <div className="ind-item">
          <div className="ind-label">RSI (14)</div>
          <div className="ind-value">{indicators.rsi}</div>
        </div>
        <div className="ind-item">
          <div className="ind-label">MACD</div>
          <div className="ind-value">{indicators.macd}</div>
        </div>
        <div className="ind-item">
          <div className="ind-label">EMA 9</div>
          <div className="ind-value">${indicators.ema9?.toLocaleString()}</div>
        </div>
        <div className="ind-item">
          <div className="ind-label">EMA 21</div>
          <div className="ind-value">${indicators.ema21?.toLocaleString()}</div>
        </div>
        <div className="ind-item">
          <div className="ind-label">ADX</div>
          <div className="ind-value">{indicators.adx}</div>
        </div>
        <div className="ind-item">
          <div className="ind-label">Supertrend</div>
          <div className={`ind-value ${indicators.supertrendDir === 'Bullish' ? 'text-green' : 'text-red'}`}>
            {indicators.supertrendDir}
          </div>
        </div>
        <div className="ind-item">
          <div className="ind-label">Stoch RSI K</div>
          <div className="ind-value">{indicators.stochK}</div>
        </div>
        <div className="ind-item">
          <div className="ind-label">OBV Trend</div>
          <div className="ind-value">{indicators.obvTrend}</div>
        </div>
      </div>
    </div>
  );
};

export default IndicatorGrid;
