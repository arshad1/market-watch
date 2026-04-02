import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Label
} from 'recharts';

/**
 * Computes payoff data for multi-leg option strategies
 * @param {Array} legs - [{type:'Call'|'Put', direction:'Buy'|'Sell', strike, premium, quantity}]
 * @param {number} currentPrice
 */
function computePayoff(legs, currentPrice) {
  if (!legs || legs.length === 0) return [];

  const min = currentPrice * 0.7;
  const max = currentPrice * 1.3;
  const steps = 120;
  const stepSize = (max - min) / steps;

  const data = [];
  for (let i = 0; i <= steps; i++) {
    const price = min + i * stepSize;
    let totalPnl = 0;

    for (const leg of legs) {
      const qty = leg.quantity || 1;
      const premium = parseFloat(leg.premium) || 0;
      const strike = parseFloat(leg.strike) || currentPrice;
      const mult = leg.direction === 'Buy' ? 1 : -1;

      let intrinsic = 0;
      if (leg.type === 'Call') {
        intrinsic = Math.max(0, price - strike);
      } else {
        intrinsic = Math.max(0, strike - price);
      }

      // PnL per unit = (intrinsic - premium) * direction
      totalPnl += mult * (intrinsic - premium) * qty;
    }

    data.push({
      price: Math.round(price),
      pnl: parseFloat(totalPnl.toFixed(2)),
    });
  }
  return data;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const pnl = payload[0].value;
    const isProfit = pnl >= 0;
    return (
      <div style={{
        background: 'rgba(10, 11, 16, 0.95)',
        border: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.875rem'
      }}>
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>Price: <strong style={{ color: '#fff' }}>${label?.toLocaleString()}</strong></div>
        <div style={{ color: isProfit ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          P&L: {isProfit ? '+' : ''}${pnl?.toLocaleString()}
        </div>
      </div>
    );
  }
  return null;
};

const PayoffChart = ({ legs, currentPrice }) => {
  const data = useMemo(() => computePayoff(legs, currentPrice), [legs, currentPrice]);
  
  const maxPnl = Math.max(...data.map(d => d.pnl));
  const minPnl = Math.min(...data.map(d => d.pnl));

  const gradientId = 'payoffGradient';

  if (!legs || legs.length === 0) {
    return (
      <div className="payoff-chart-empty">
        <p>Add strategy legs to see the payoff diagram</p>
      </div>
    );
  }

  return (
    <div className="payoff-chart-wrapper">
      <div className="payoff-stats-row">
        <div className="payoff-stat profit">
          <span className="payoff-stat-label">Max Profit</span>
          <span className="payoff-stat-value">
            {maxPnl > 9000000 ? '∞' : `$${maxPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="payoff-stat loss">
          <span className="payoff-stat-label">Max Loss</span>
          <span className="payoff-stat-value">
            {minPnl < -9000000 ? '-∞' : `$${minPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="payoff-stat neutral">
          <span className="payoff-stat-label">Current Price</span>
          <span className="payoff-stat-value">${currentPrice?.toLocaleString()}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <defs>
            <linearGradient id={`${gradientId}_pos`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={`${gradientId}_neg`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.02} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="price"
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
          <ReferenceLine
            x={currentPrice}
            stroke="rgba(99, 179, 237, 0.5)"
            strokeDasharray="4 4"
            label={{ value: 'Current', position: 'top', fill: '#63b3ed', fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke="#10b981"
            strokeWidth={2.5}
            fill={`url(#${gradientId}_pos)`}
            dot={false}
            activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PayoffChart;
