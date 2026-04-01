const { RSI, MACD } = require('technicalindicators');

function calculateIndicators(candles5m) {
  // Binance OHLCV index 4 is the close price string
  const closes = candles5m.map(c => parseFloat(c[4]));

  const rsiInput = { values: closes, period: 14 };
  const rsiResults = RSI.calculate(rsiInput);
  
  const macdInput = {
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  };
  const macdResults = MACD.calculate(macdInput);

  const currentRSI = rsiResults[rsiResults.length - 1] || 50;
  const currentMACD = macdResults[macdResults.length - 1] || { MACD: 0, signal: 0, histogram: 0 };

  return {
    rsi: currentRSI.toFixed(2),
    macd: currentMACD.MACD ? currentMACD.MACD.toFixed(2) : "0.00",
    macdSignal: currentMACD.signal ? currentMACD.signal.toFixed(2) : "0.00"
  };
}

module.exports = { calculateIndicators };
