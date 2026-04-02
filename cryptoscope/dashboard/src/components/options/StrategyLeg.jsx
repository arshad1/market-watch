import React from 'react';
import { TrendingUp, TrendingDown, Minus, X, ChevronDown } from 'lucide-react';

const OPTION_TYPES = ['Call', 'Put'];
const DIRECTIONS = ['Buy', 'Sell'];
const EXPIRY_OPTIONS = ['1 day', '3 days', '7 days', '14 days', '30 days'];

const StrategyLeg = ({ leg, index, currentPrice, onUpdate, onRemove }) => {
  const isCall = leg.type === 'Call';
  const isBuy = leg.direction === 'Buy';
  const moneyness = leg.strike > 0
    ? ((leg.strike - currentPrice) / currentPrice * 100).toFixed(1)
    : '0.0';

  const moneynessLabel =
    Math.abs(moneyness) < 1 ? 'ATM' :
    (isCall && moneyness > 0) || (!isCall && moneyness < 0) ? 'OTM' : 'ITM';

  const moneynessColor =
    moneynessLabel === 'ATM' ? '#f59e0b' :
    moneynessLabel === 'OTM' ? '#60a5fa' : '#a78bfa';

  const handleChange = (field, value) => {
    onUpdate(index, { ...leg, [field]: value });
  };

  return (
    <div className={`strategy-leg ${isBuy ? 'leg-buy' : 'leg-sell'}`}>
      <div className="leg-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={`leg-badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
            {isBuy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            Leg {index + 1}
          </div>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            color: moneynessColor,
            background: `${moneynessColor}22`,
            padding: '2px 8px', borderRadius: 999
          }}>
            {moneynessLabel}
          </span>
        </div>
        <button className="leg-remove" onClick={() => onRemove(index)} title="Remove leg">
          <X size={14} />
        </button>
      </div>

      <div className="leg-controls">
        {/* Type selector */}
        <div className="leg-field">
          <label>Type</label>
          <div className="toggle-group">
            {OPTION_TYPES.map(t => (
              <button
                key={t}
                className={`toggle-btn ${leg.type === t ? 'active' : ''} ${t === 'Call' ? 'call-color' : 'put-color'}`}
                onClick={() => handleChange('type', t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Direction selector */}
        <div className="leg-field">
          <label>Direction</label>
          <div className="toggle-group">
            {DIRECTIONS.map(d => (
              <button
                key={d}
                className={`toggle-btn ${leg.direction === d ? 'active' : ''} ${d === 'Buy' ? 'buy-color' : 'sell-color'}`}
                onClick={() => handleChange('direction', d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Strike input */}
        <div className="leg-field">
          <label>Strike ($)</label>
          <input
            type="number"
            className="leg-input"
            value={leg.strike || ''}
            placeholder={Math.round(currentPrice)}
            min={1}
            onChange={e => handleChange('strike', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Premium input */}
        <div className="leg-field">
          <label>Premium ($)</label>
          <input
            type="number"
            className="leg-input"
            value={leg.premium || ''}
            placeholder="0.00"
            min={0}
            step={0.01}
            onChange={e => handleChange('premium', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Quantity input */}
        <div className="leg-field">
          <label>Qty</label>
          <input
            type="number"
            className="leg-input"
            value={leg.quantity || 1}
            min={1}
            onChange={e => handleChange('quantity', parseInt(e.target.value) || 1)}
          />
        </div>

        {/* Expiry selector */}
        <div className="leg-field">
          <label>Expiry</label>
          <div className="select-wrapper">
            <select
              className="leg-select"
              value={leg.expiry || '7 days'}
              onChange={e => handleChange('expiry', e.target.value)}
            >
              {EXPIRY_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <ChevronDown size={14} className="select-icon" />
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="leg-summary">
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
          {leg.direction} 1x {leg.type} @ ${leg.strike || currentPrice} | Cost: <strong style={{ color: isBuy ? '#ef4444' : '#10b981' }}>
            {isBuy ? '-' : '+'}${((leg.premium || 0) * (leg.quantity || 1)).toFixed(2)}
          </strong>
        </span>
        {moneyness !== '0.0' && (
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
            {moneyness > 0 ? '+' : ''}{moneyness}% from current
          </span>
        )}
      </div>
    </div>
  );
};

export default StrategyLeg;
