const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Predefined strategy templates
const STRATEGIES = [
  {
    id: 'long_call',
    name: 'Long Call',
    type: 'Debit',
    bias: 'Bullish',
    description: 'Buy a call option. Profit if price rises above strike + premium.',
    legs: [{ type: 'Call', direction: 'Buy', quantity: 1 }],
    historicalWinRate: 35,
    minCapital: 200,
    riskProfile: 'Limited Risk, Unlimited Reward'
  },
  {
    id: 'long_put',
    name: 'Long Put',
    type: 'Debit',
    bias: 'Bearish',
    description: 'Buy a put option. Profit if price falls below strike - premium.',
    legs: [{ type: 'Put', direction: 'Buy', quantity: 1 }],
    historicalWinRate: 32,
    minCapital: 200,
    riskProfile: 'Limited Risk, High Reward'
  },
  {
    id: 'covered_call',
    name: 'Covered Call',
    type: 'Credit',
    bias: 'Neutral/Bullish',
    description: 'Hold underlying + sell a call. Generate income on existing holdings.',
    legs: [{ type: 'Call', direction: 'Sell', quantity: 1 }],
    historicalWinRate: 68,
    minCapital: 5000,
    riskProfile: 'Moderate Risk, Limited Reward'
  },
  {
    id: 'cash_secured_put',
    name: 'Cash-Secured Put',
    type: 'Credit',
    bias: 'Neutral/Bullish',
    description: 'Sell a put with cash collateral. Profit if price stays above strike.',
    legs: [{ type: 'Put', direction: 'Sell', quantity: 1 }],
    historicalWinRate: 65,
    minCapital: 3000,
    riskProfile: 'Moderate Risk, Limited Reward'
  },
  {
    id: 'bull_call_spread',
    name: 'Bull Call Spread',
    type: 'Debit',
    bias: 'Bullish',
    description: 'Buy lower strike call + sell higher strike call. Defined risk bullish play.',
    legs: [
      { type: 'Call', direction: 'Buy', quantity: 1, role: 'Lower Strike' },
      { type: 'Call', direction: 'Sell', quantity: 1, role: 'Higher Strike' }
    ],
    historicalWinRate: 48,
    minCapital: 500,
    riskProfile: 'Limited Risk, Limited Reward'
  },
  {
    id: 'bear_put_spread',
    name: 'Bear Put Spread',
    type: 'Debit',
    bias: 'Bearish',
    description: 'Buy higher strike put + sell lower strike put. Defined risk bearish play.',
    legs: [
      { type: 'Put', direction: 'Buy', quantity: 1, role: 'Higher Strike' },
      { type: 'Put', direction: 'Sell', quantity: 1, role: 'Lower Strike' }
    ],
    historicalWinRate: 45,
    minCapital: 500,
    riskProfile: 'Limited Risk, Limited Reward'
  },
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    type: 'Credit',
    bias: 'Neutral',
    description: 'Sell OTM call spread + sell OTM put spread. Profit from range-bound market.',
    legs: [
      { type: 'Put', direction: 'Buy', quantity: 1, role: 'Far OTM Put' },
      { type: 'Put', direction: 'Sell', quantity: 1, role: 'OTM Put' },
      { type: 'Call', direction: 'Sell', quantity: 1, role: 'OTM Call' },
      { type: 'Call', direction: 'Buy', quantity: 1, role: 'Far OTM Call' }
    ],
    historicalWinRate: 72,
    minCapital: 2000,
    riskProfile: 'Defined Risk, High Probability'
  },
  {
    id: 'straddle',
    name: 'Long Straddle',
    type: 'Debit',
    bias: 'Volatile',
    description: 'Buy ATM call + ATM put. Profit from big move in either direction.',
    legs: [
      { type: 'Call', direction: 'Buy', quantity: 1, role: 'ATM Call' },
      { type: 'Put', direction: 'Buy', quantity: 1, role: 'ATM Put' }
    ],
    historicalWinRate: 38,
    minCapital: 800,
    riskProfile: 'Limited Risk, Unlimited Reward'
  },
  {
    id: 'strangle',
    name: 'Long Strangle',
    type: 'Debit',
    bias: 'Volatile',
    description: 'Buy OTM call + OTM put. Cheaper than straddle, needs bigger move.',
    legs: [
      { type: 'Call', direction: 'Buy', quantity: 1, role: 'OTM Call' },
      { type: 'Put', direction: 'Buy', quantity: 1, role: 'OTM Put' }
    ],
    historicalWinRate: 30,
    minCapital: 400,
    riskProfile: 'Limited Risk, High Reward Potential'
  }
];

/**
 * Build a mock options chain for a given price (simulates real IV data)
 */
function buildMockOptionsChain(currentPrice) {
  const strikes = [];
  const step = currentPrice * 0.02; // 2% intervals
  for (let i = -5; i <= 5; i++) {
    const strike = Math.round((currentPrice + i * step) / 10) * 10;
    const moneyness = (strike - currentPrice) / currentPrice;
    // Volatility smile: ATM lowest IV, wings higher
    const iv = 45 + Math.abs(moneyness) * 200;
    // Simple Black-Scholes approximation for premium
    const callPremium = Math.max(currentPrice - strike, 0) + (currentPrice * (iv / 100) * 0.3);
    const putPremium  = Math.max(strike - currentPrice, 0) + (currentPrice * (iv / 100) * 0.3);
    strikes.push({
      strike: Math.round(strike),
      iv: Math.round(iv),
      callPremium: Math.round(callPremium * 100) / 100,
      putPremium: Math.round(putPremium * 100) / 100,
      callDelta: Math.max(0.05, Math.min(0.95, 0.5 - moneyness * 3)),
      putDelta: Math.max(-0.95, Math.min(-0.05, -0.5 - moneyness * 3))
    });
  }
  return strikes;
}

/**
 * Estimate historical setup matches (mock backtest)
 */
function estimateHistoricalMatches(rsi, changePct, strategyBias) {
  let matches = Math.floor(Math.random() * 20) + 5;
  let winRate = 50;
  
  if (strategyBias === 'Bullish' && rsi < 40) { winRate = 62; matches += 5; }
  else if (strategyBias === 'Bullish' && rsi > 70) { winRate = 28; }
  else if (strategyBias === 'Bearish' && rsi > 65) { winRate = 58; matches += 3; }
  else if (strategyBias === 'Neutral') { winRate = 65; }
  else if (strategyBias === 'Volatile') { winRate = Math.abs(changePct) > 3 ? 55 : 30; }
  
  return { matches, winRate };
}

/**
 * Fetch recent news for context (uses SerpAPI if configured)
 */
async function fetchNewsContext(asset) {
  if (!process.env.SERPAPI_KEY) return 'No external news context available.';
  try {
    const query = `${asset} options trading${new Date().toLocaleDateString()}`;
    const res = await axios.get('https://serpapi.com/search', {
      params: { q: query, engine: 'google_news', api_key: process.env.SERPAPI_KEY, num: 3 }
    });
    const results = res.data.news_results || [];
    return results.slice(0, 3).map(r => `- ${r.title}`).join('\n') || 'No recent news found.';
  } catch {
    return 'News fetch unavailable.';
  }
}

/**
 * Analyze an options strategy using the AI engine
 */
async function analyzeStrategy(strategyId, legs, marketData) {
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DeepSeek API Key not configured.');
  }

  const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
  });

  const strategy = STRATEGIES.find(s => s.id === strategyId) || {
    name: 'Custom Strategy',
    type: 'Custom',
    bias: 'Mixed',
    historicalWinRate: 50
  };

  const { matches, winRate } = estimateHistoricalMatches(
    marketData.rsi, marketData.changePct, strategy.bias
  );

  const newsContext = await fetchNewsContext(marketData.asset);
  const optionsChain = buildMockOptionsChain(marketData.price);

  // Format legs for the prompt
  const legsDetail = legs.map((leg, i) => {
    const chainEntry = optionsChain.find(o => Math.abs(o.strike - leg.strike) < 100) || optionsChain[5];
    return `  Leg ${i + 1}: ${leg.direction} ${leg.quantity}x ${leg.type} @ Strike $${leg.strike} | Premium: $${leg.direction === 'Buy' ? chainEntry.callPremium : chainEntry.callPremium} | IV: ${chainEntry.iv}% | Delta: ${leg.type === 'Call' ? chainEntry.callDelta.toFixed(2) : chainEntry.putDelta.toFixed(2)} | Expiry: ${leg.expiry || '7 days'}`;
  }).join('\n');

  // Estimated IV from chain ATM
  const atmStrike = optionsChain[5];
  const ivEstimate = atmStrike ? atmStrike.iv : 45;

  const templatePath = path.join(__dirname, '..', 'prompts', 'options_strategy.txt');
  let prompt = fs.readFileSync(templatePath, 'utf8');

  prompt = prompt
    .replace('{{ASSET}}', marketData.asset)
    .replace('{{PRICE}}', marketData.price)
    .replace('{{CHANGE_PCT}}', marketData.changePct)
    .replace('{{RSI}}', marketData.rsi)
    .replace('{{MACD_VAL}}', marketData.macd)
    .replace('{{MACD_SIGNAL}}', marketData.macdSignal)
    .replace('{{IV_ESTIMATE}}', ivEstimate)
    .replace('{{MARKET_SENTIMENT}}', marketData.sentiment || 'Neutral')
    .replace('{{TIMESTAMP}}', new Date().toISOString())
    .replace('{{STRATEGY_NAME}}', strategy.name)
    .replace('{{STRATEGY_TYPE}}', strategy.type)
    .replace('{{MARKET_BIAS}}', strategy.bias)
    .replace('{{LEGS_DETAIL}}', legsDetail)
    .replace('{{HISTORICAL_MATCHES}}', matches)
    .replace('{{HISTORICAL_WIN_RATE}}', winRate)
    .replace('{{NEWS_CONTEXT}}', newsContext);

  const useModel = process.env.AI_MODEL || 'deepseek-chat';
  console.log(`[optionsEngine] Calling DeepSeek (${useModel}) for strategy analysis...`);

  const response = await client.chat.completions.create({
    model: useModel,
    max_tokens: 1500,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.choices[0].message.content;
  
  // Parse JSON response
  try {
    // Extract JSON from the response (sometimes model wraps it in ```json blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        ...JSON.parse(jsonMatch[0]),
        options_chain: optionsChain,
        strategy_meta: {
          ...strategy,
          backtested_matches: matches,
          backtested_win_rate: winRate
        }
      };
    }
  } catch (e) {
    console.error('[optionsEngine] JSON parse error:', e.message);
  }

  // Fallback if JSON parsing fails
  return {
    raw_analysis: raw,
    probability_of_profit: winRate,
    fund_required: strategy.minCapital,
    fund_flow: strategy.type === 'Debit' ? 'Debit' : 'Credit',
    disclaimer: 'Options trading involves substantial risk.',
    options_chain: optionsChain,
    strategy_meta: strategy
  };
}

module.exports = { analyzeStrategy, STRATEGIES, buildMockOptionsChain };
