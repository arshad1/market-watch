/**
 * CryptoScope Premium Indicator Library
 * Institutional-grade technical analysis calculations
 */

import { calculateSMA, calculateEMA, calculateRSI } from './pinescript';

// ══════════════════════════════════════════════════════════════
// 1. NADARAYA-WATSON KERNEL REGRESSION ENVELOPE
//    Non-parametric regression with Gaussian kernel smoothing
// ══════════════════════════════════════════════════════════════
export function calculateNadarayaWatson(series, bandwidth = 8, mult = 3.0) {
  const n = series.length;
  const smoothed = new Array(n).fill(null);
  const upper = new Array(n).fill(null);
  const lower = new Array(n).fill(null);

  // Limit window to avoid O(n²) blow-up on large datasets
  const windowSize = Math.min(n, 250);

  for (let i = 0; i < n; i++) {
    let weightedSum = 0;
    let sumOfWeights = 0;
    const start = Math.max(0, i - windowSize);
    const end = Math.min(n - 1, i + windowSize);

    for (let j = start; j <= end; j++) {
      const dist = (i - j) / bandwidth;
      const weight = Math.exp(-0.5 * dist * dist);
      weightedSum += weight * series[j];
      sumOfWeights += weight;
    }

    smoothed[i] = sumOfWeights > 0 ? weightedSum / sumOfWeights : series[i];
  }

  // Calculate adaptive envelope using MAE (mean absolute error)
  let maeSum = 0;
  let maeCount = 0;
  for (let i = 0; i < n; i++) {
    if (smoothed[i] !== null) {
      maeSum += Math.abs(series[i] - smoothed[i]);
      maeCount++;
    }
  }
  const mae = maeCount > 0 ? maeSum / maeCount : 0;

  for (let i = 0; i < n; i++) {
    if (smoothed[i] !== null) {
      upper[i] = Number((smoothed[i] + mult * mae).toFixed(4));
      lower[i] = Number((smoothed[i] - mult * mae).toFixed(4));
      smoothed[i] = Number(smoothed[i].toFixed(4));
    }
  }

  return { smoothed, upper, lower };
}

// ══════════════════════════════════════════════════════════════
// 2. MACD (Moving Average Convergence Divergence)
//    Signal line + Histogram
// ══════════════════════════════════════════════════════════════
export function calculateMACD(series, fastLen = 12, slowLen = 26, signalLen = 9) {
  const emaFast = calculateEMA(series, fastLen);
  const emaSlow = calculateEMA(series, slowLen);
  const n = series.length;
  const macdLine = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine[i] = Number((emaFast[i] - emaSlow[i]).toFixed(4));
    }
  }

  // Signal line = EMA of MACD line (only from valid values)
  const validMacd = macdLine.filter(v => v !== null);
  const signalEma = calculateEMA(validMacd, signalLen);

  const signal = new Array(n).fill(null);
  let validIdx = 0;
  for (let i = 0; i < n; i++) {
    if (macdLine[i] !== null) {
      signal[i] = signalEma[validIdx] !== null ? Number(signalEma[validIdx].toFixed(4)) : null;
      validIdx++;
    }
  }

  const histogram = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (macdLine[i] !== null && signal[i] !== null) {
      histogram[i] = Number((macdLine[i] - signal[i]).toFixed(4));
    }
  }

  return { macdLine, signal, histogram };
}

// ══════════════════════════════════════════════════════════════
// 3. SUPERTREND
//    ATR-based dynamic trailing support/resistance
// ══════════════════════════════════════════════════════════════
export function calculateSupertrend(candles, period = 10, multiplier = 3.0) {
  const n = candles.length;
  const supertrend = new Array(n).fill(null);
  const direction = new Array(n).fill(0); // 1=up, -1=down

  if (n < period) return { supertrend, direction };

  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const close = candles.map(c => c.close);

  // ATR calculation
  const tr = [high[0] - low[0]];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])));
  }
  const atr = calculateSMA(tr, period);

  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let prevSupertrend = 0;
  let prevDir = 1;

  for (let i = 0; i < n; i++) {
    if (atr[i] === null) continue;

    const hl2 = (high[i] + low[i]) / 2;
    let upperBand = hl2 + multiplier * atr[i];
    let lowerBand = hl2 - multiplier * atr[i];

    // Band continuity
    if (i > 0) {
      upperBand = (upperBand < prevUpperBand || close[i - 1] > prevUpperBand) ? upperBand : prevUpperBand;
      lowerBand = (lowerBand > prevLowerBand || close[i - 1] < prevLowerBand) ? lowerBand : prevLowerBand;
    }

    // Direction
    let dir;
    if (i === 0 || prevSupertrend === 0) {
      dir = close[i] <= upperBand ? 1 : -1;
    } else if (prevSupertrend === prevUpperBand) {
      dir = close[i] > upperBand ? 1 : -1;
    } else {
      dir = close[i] < lowerBand ? -1 : 1;
    }

    const st = dir === 1 ? lowerBand : upperBand;

    supertrend[i] = Number(st.toFixed(4));
    direction[i] = dir;

    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
    prevSupertrend = st;
    prevDir = dir;
  }

  return { supertrend, direction };
}

// ══════════════════════════════════════════════════════════════
// 4. VWAP with Standard Deviation Bands
//    Intraday volume-weighted average price
// ══════════════════════════════════════════════════════════════
export function calculateVWAP(candles, showBands = true) {
  const n = candles.length;
  const vwap = new Array(n).fill(null);
  const upperBand1 = new Array(n).fill(null);
  const lowerBand1 = new Array(n).fill(null);
  const upperBand2 = new Array(n).fill(null);
  const lowerBand2 = new Array(n).fill(null);

  let cumVolume = 0;
  let cumTPV = 0; // typical price * volume
  let cumTPV2 = 0;

  for (let i = 0; i < n; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const vol = candles[i].volume || 1;

    cumVolume += vol;
    cumTPV += tp * vol;
    cumTPV2 += tp * tp * vol;

    const vwapVal = cumTPV / cumVolume;
    vwap[i] = Number(vwapVal.toFixed(4));

    if (showBands && cumVolume > 0) {
      const variance = (cumTPV2 / cumVolume) - (vwapVal * vwapVal);
      const stdDev = Math.sqrt(Math.max(0, variance));

      upperBand1[i] = Number((vwapVal + stdDev).toFixed(4));
      lowerBand1[i] = Number((vwapVal - stdDev).toFixed(4));
      upperBand2[i] = Number((vwapVal + 2 * stdDev).toFixed(4));
      lowerBand2[i] = Number((vwapVal - 2 * stdDev).toFixed(4));
    }
  }

  return { vwap, upperBand1, lowerBand1, upperBand2, lowerBand2 };
}

// ══════════════════════════════════════════════════════════════
// 5. ICHIMOKU CLOUD
//    Tenkan-sen, Kijun-sen, Senkou Span A/B, Chikou Span
// ══════════════════════════════════════════════════════════════
export function calculateIchimoku(candles, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52, displacement = 26) {
  const n = candles.length;
  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const close = candles.map(c => c.close);

  function donchianMid(src_high, src_low, len, idx) {
    if (idx < len - 1) return null;
    let maxH = -Infinity, minL = Infinity;
    for (let j = 0; j < len; j++) {
      if (src_high[idx - j] > maxH) maxH = src_high[idx - j];
      if (src_low[idx - j] < minL) minL = src_low[idx - j];
    }
    return (maxH + minL) / 2;
  }

  const tenkan = new Array(n).fill(null);
  const kijun = new Array(n).fill(null);
  const senkouA = new Array(n + displacement).fill(null);
  const senkouB = new Array(n + displacement).fill(null);
  const chikou = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    tenkan[i] = donchianMid(high, low, tenkanPeriod, i);
    kijun[i] = donchianMid(high, low, kijunPeriod, i);

    // Senkou Span A = (Tenkan + Kijun) / 2 shifted forward
    if (tenkan[i] !== null && kijun[i] !== null) {
      senkouA[i + displacement] = Number(((tenkan[i] + kijun[i]) / 2).toFixed(4));
    }

    // Senkou Span B = Donchian mid of senkouBPeriod shifted forward
    const sbVal = donchianMid(high, low, senkouBPeriod, i);
    if (sbVal !== null) {
      senkouB[i + displacement] = Number(sbVal.toFixed(4));
    }

    // Chikou = close shifted backward
    if (i >= displacement) {
      chikou[i - displacement] = close[i];
    }

    if (tenkan[i] !== null) tenkan[i] = Number(tenkan[i].toFixed(4));
    if (kijun[i] !== null) kijun[i] = Number(kijun[i].toFixed(4));
  }

  // Trim senkou arrays to chart data length
  const senkouATrimmed = senkouA.slice(0, n);
  const senkouBTrimmed = senkouB.slice(0, n);

  return { tenkan, kijun, senkouA: senkouATrimmed, senkouB: senkouBTrimmed, chikou };
}

// ══════════════════════════════════════════════════════════════
// 6. STOCHASTIC RSI
//    RSI fed into Stochastic formula + smoothed %K and %D
// ══════════════════════════════════════════════════════════════
export function calculateStochRSI(series, rsiLen = 14, stochLen = 14, kSmooth = 3, dSmooth = 3) {
  const rsi = calculateRSI(series, rsiLen);
  const n = series.length;

  const stochK_raw = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (rsi[i] === null || i < stochLen - 1) continue;

    let minRSI = Infinity;
    let maxRSI = -Infinity;
    let valid = true;

    for (let j = 0; j < stochLen; j++) {
      const val = rsi[i - j];
      if (val === null) { valid = false; break; }
      if (val < minRSI) minRSI = val;
      if (val > maxRSI) maxRSI = val;
    }

    if (valid && maxRSI !== minRSI) {
      stochK_raw[i] = ((rsi[i] - minRSI) / (maxRSI - minRSI)) * 100;
    } else if (valid) {
      stochK_raw[i] = 50;
    }
  }

  // Smooth %K
  const validK = stochK_raw.filter(v => v !== null);
  const smoothedK = calculateSMA(validK, kSmooth);
  const k = new Array(n).fill(null);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if (stochK_raw[i] !== null) {
      k[i] = smoothedK[idx] !== null ? Number(smoothedK[idx].toFixed(2)) : null;
      idx++;
    }
  }

  // %D = SMA of %K
  const validKForD = k.filter(v => v !== null);
  const smoothedD = calculateSMA(validKForD, dSmooth);
  const d = new Array(n).fill(null);
  idx = 0;
  for (let i = 0; i < n; i++) {
    if (k[i] !== null) {
      d[i] = smoothedD[idx] !== null ? Number(smoothedD[idx].toFixed(2)) : null;
      idx++;
    }
  }

  return { k, d };
}

// ══════════════════════════════════════════════════════════════
// 7. ATR TRAILING STOP (Chandelier Exit)
//    Dynamic stop-loss based on ATR volatility
// ══════════════════════════════════════════════════════════════
export function calculateATRTrailingStop(candles, period = 22, multiplier = 3.0) {
  const n = candles.length;
  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const close = candles.map(c => c.close);

  // ATR
  const tr = [high[0] - low[0]];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])));
  }
  const atr = calculateSMA(tr, period);

  const stopLine = new Array(n).fill(null);
  const trailDir = new Array(n).fill(0); // 1=long, -1=short

  let prevStop = 0;
  let prevDir = 1;

  for (let i = period - 1; i < n; i++) {
    if (atr[i] === null) continue;

    const longStop = close[i] - multiplier * atr[i];
    const shortStop = close[i] + multiplier * atr[i];

    let dir;
    if (i === period - 1) {
      dir = close[i] > (high[i] + low[i]) / 2 ? 1 : -1;
      stopLine[i] = dir === 1 ? longStop : shortStop;
    } else {
      if (prevDir === 1) {
        const newLongStop = Math.max(longStop, prevStop);
        if (close[i] < prevStop) {
          dir = -1;
          stopLine[i] = shortStop;
        } else {
          dir = 1;
          stopLine[i] = newLongStop;
        }
      } else {
        const newShortStop = Math.min(shortStop, prevStop);
        if (close[i] > prevStop) {
          dir = 1;
          stopLine[i] = longStop;
        } else {
          dir = -1;
          stopLine[i] = newShortStop;
        }
      }
    }

    stopLine[i] = Number(stopLine[i].toFixed(4));
    trailDir[i] = dir;
    prevStop = stopLine[i];
    prevDir = dir;
  }

  return { stopLine, trailDir };
}

// ══════════════════════════════════════════════════════════════
// 8. LIQUIDITY SWEEP DETECTION
//    Detects stop-hunt / liquidity grabs at swing extremes
// ══════════════════════════════════════════════════════════════
export function detectLiquiditySweeps(candles, lookback = 10, threshold = 0.3) {
  const n = candles.length;
  const sweeps = [];

  if (n < lookback * 2) return sweeps;

  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const close = candles.map(c => c.close);
  const open = candles.map(c => c.open);

  for (let i = lookback; i < n - 1; i++) {
    // Find highest high in lookback window before i
    let maxHigh = -Infinity;
    for (let j = i - lookback; j < i; j++) {
      if (high[j] > maxHigh) maxHigh = high[j];
    }

    // Find lowest low in lookback window before i
    let minLow = Infinity;
    for (let j = i - lookback; j < i; j++) {
      if (low[j] < minLow) minLow = low[j];
    }

    const range = maxHigh - minLow;
    if (range <= 0) continue;

    // Bearish sweep: wick above prior highs but close below
    if (high[i] > maxHigh && close[i] < maxHigh) {
      const wickRatio = (high[i] - Math.max(open[i], close[i])) / range;
      if (wickRatio > threshold * 0.1) {
        sweeps.push({
          type: 'bearish',
          index: i,
          price: high[i],
          level: maxHigh,
          time: candles[i].time,
          label: '🔻 Liq. Sweep'
        });
      }
    }

    // Bullish sweep: wick below prior lows but close above
    if (low[i] < minLow && close[i] > minLow) {
      const wickRatio = (Math.min(open[i], close[i]) - low[i]) / range;
      if (wickRatio > threshold * 0.1) {
        sweeps.push({
          type: 'bullish',
          index: i,
          price: low[i],
          level: minLow,
          time: candles[i].time,
          label: '🔺 Liq. Sweep'
        });
      }
    }
  }

  return sweeps;
}

// ══════════════════════════════════════════════════════════════
// 9. VOLUME PROFILE (Simplified)
//    Point of Control, Value Area High/Low
// ══════════════════════════════════════════════════════════════
export function calculateVolumeProfile(candles, numBins = 24) {
  const n = candles.length;
  if (n === 0) return { bins: [], poc: null, vah: null, val: null };

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (let i = 0; i < n; i++) {
    if (candles[i].low < minPrice) minPrice = candles[i].low;
    if (candles[i].high > maxPrice) maxPrice = candles[i].high;
  }

  const range = maxPrice - minPrice;
  if (range <= 0) return { bins: [], poc: null, vah: null, val: null };

  const binSize = range / numBins;
  const bins = new Array(numBins).fill(0).map((_, i) => ({
    priceStart: minPrice + i * binSize,
    priceEnd: minPrice + (i + 1) * binSize,
    priceMid: minPrice + (i + 0.5) * binSize,
    volume: 0
  }));

  // Distribute volume across bins
  for (let i = 0; i < n; i++) {
    const vol = candles[i].volume || 1;
    const lo = candles[i].low;
    const hi = candles[i].high;

    for (let b = 0; b < numBins; b++) {
      // Check overlap
      const overlap = Math.max(0, Math.min(hi, bins[b].priceEnd) - Math.max(lo, bins[b].priceStart));
      const candleRange = hi - lo || 1;
      bins[b].volume += vol * (overlap / candleRange);
    }
  }

  // Normalize volumes
  const maxVol = Math.max(...bins.map(b => b.volume));
  bins.forEach(b => {
    b.normalizedVolume = maxVol > 0 ? b.volume / maxVol : 0;
  });

  // POC = bin with highest volume
  let pocIdx = 0;
  for (let b = 1; b < numBins; b++) {
    if (bins[b].volume > bins[pocIdx].volume) pocIdx = b;
  }
  const poc = bins[pocIdx].priceMid;

  // Value Area = 70% of total volume around POC
  const totalVol = bins.reduce((sum, b) => sum + b.volume, 0);
  const targetVol = totalVol * 0.70;

  let vaVol = bins[pocIdx].volume;
  let vaHigh = pocIdx;
  let vaLow = pocIdx;

  while (vaVol < targetVol) {
    const expandUp = vaHigh + 1 < numBins ? bins[vaHigh + 1].volume : 0;
    const expandDown = vaLow - 1 >= 0 ? bins[vaLow - 1].volume : 0;

    if (expandUp >= expandDown && vaHigh + 1 < numBins) {
      vaHigh++;
      vaVol += bins[vaHigh].volume;
    } else if (vaLow - 1 >= 0) {
      vaLow--;
      vaVol += bins[vaLow].volume;
    } else {
      break;
    }
  }

  return {
    bins,
    poc: Number(poc.toFixed(4)),
    vah: Number(bins[vaHigh].priceEnd.toFixed(4)),
    val: Number(bins[vaLow].priceStart.toFixed(4))
  };
}

// ══════════════════════════════════════════════════════════════
// 10. RSI DIVERGENCE DETECTOR
//     Detects bullish & bearish divergences between price and RSI
// ══════════════════════════════════════════════════════════════
export function detectDivergences(candles, rsiPeriod = 14, pivotLookback = 5) {
  const n = candles.length;
  const divergences = [];

  if (n < rsiPeriod + pivotLookback * 2) return divergences;

  const close = candles.map(c => c.close);
  const low = candles.map(c => c.low);
  const high = candles.map(c => c.high);
  const rsi = calculateRSI(close, rsiPeriod);

  // Find pivot lows
  const pivotLows = [];
  const pivotHighs = [];

  for (let i = pivotLookback; i < n - pivotLookback; i++) {
    if (rsi[i] === null) continue;

    // Pivot low
    let isPivotLow = true;
    for (let j = 1; j <= pivotLookback; j++) {
      if (rsi[i - j] !== null && rsi[i - j] <= rsi[i]) { isPivotLow = false; break; }
      if (rsi[i + j] !== null && rsi[i + j] <= rsi[i]) { isPivotLow = false; break; }
    }
    if (isPivotLow) pivotLows.push(i);

    // Pivot high
    let isPivotHigh = true;
    for (let j = 1; j <= pivotLookback; j++) {
      if (rsi[i - j] !== null && rsi[i - j] >= rsi[i]) { isPivotHigh = false; break; }
      if (rsi[i + j] !== null && rsi[i + j] >= rsi[i]) { isPivotHigh = false; break; }
    }
    if (isPivotHigh) pivotHighs.push(i);
  }

  // Bullish divergence: price makes lower low, RSI makes higher low
  for (let k = 1; k < pivotLows.length; k++) {
    const currIdx = pivotLows[k];
    const prevIdx = pivotLows[k - 1];

    if (low[currIdx] < low[prevIdx] && rsi[currIdx] > rsi[prevIdx]) {
      divergences.push({
        type: 'bullish',
        index: currIdx,
        time: candles[currIdx].time,
        price: low[currIdx],
        label: '⬆ Bull Div'
      });
    }
  }

  // Bearish divergence: price makes higher high, RSI makes lower high
  for (let k = 1; k < pivotHighs.length; k++) {
    const currIdx = pivotHighs[k];
    const prevIdx = pivotHighs[k - 1];

    if (high[currIdx] > high[prevIdx] && rsi[currIdx] < rsi[prevIdx]) {
      divergences.push({
        type: 'bearish',
        index: currIdx,
        time: candles[currIdx].time,
        price: high[currIdx],
        label: '⬇ Bear Div'
      });
    }
  }

  return divergences;
}

// ══════════════════════════════════════════════════════════════
// 11. BOLLINGER BANDS
// ══════════════════════════════════════════════════════════════
export function calculateBollingerBands(series, length = 20, numStdDev = 2) {
  const basis = calculateSMA(series, length);
  const upper = [];
  const lower = [];

  for (let i = 0; i < series.length; i++) {
    if (i < length - 1 || basis[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const mean = basis[i];
      let varianceSum = 0;
      for (let j = 0; j < length; j++) {
        varianceSum += Math.pow(series[i - j] - mean, 2);
      }
      const stdDev = Math.sqrt(varianceSum / length);
      upper.push(Number((mean + numStdDev * stdDev).toFixed(4)));
      lower.push(Number((mean - numStdDev * stdDev).toFixed(4)));
    }
  }
  return { basis, upper, lower };
}

// ══════════════════════════════════════════════════════════════
// 12. SQUEEZE MOMENTUM (LazyBear)
// ══════════════════════════════════════════════════════════════
export function calculateSqueezeMomentum(candles, length = 20, mult = 2.0, lengthKC = 20, multKC = 1.5) {
  const size = candles.length;
  if (size < Math.max(length, lengthKC)) {
    return { histogram: new Array(size).fill(null), squeezeOn: new Array(size).fill(false) };
  }

  const close = candles.map(c => c.close);
  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);

  const bbBasis = calculateSMA(close, length);
  const bbUpper = [];
  const bbLower = [];
  for (let i = 0; i < size; i++) {
    if (i < length - 1) {
      bbUpper.push(null);
      bbLower.push(null);
    } else {
      let sumSq = 0;
      for (let j = 0; j < length; j++) {
        sumSq += Math.pow(close[i - j] - bbBasis[i], 2);
      }
      const stdDev = Math.sqrt(sumSq / length);
      bbUpper.push(bbBasis[i] + mult * stdDev);
      bbLower.push(bbBasis[i] - mult * stdDev);
    }
  }

  const kcBasis = calculateSMA(close, lengthKC);
  const tr = [high[0] - low[0]];
  for (let i = 1; i < size; i++) {
    const hl = high[i] - low[i];
    const hc = Math.abs(high[i] - close[i - 1]);
    const lc = Math.abs(low[i] - close[i - 1]);
    tr.push(Math.max(hl, hc, lc));
  }
  const atr = calculateSMA(tr, lengthKC);

  const kcUpper = [];
  const kcLower = [];
  for (let i = 0; i < size; i++) {
    if (atr[i] === null || kcBasis[i] === null) {
      kcUpper.push(null);
      kcLower.push(null);
    } else {
      kcUpper.push(kcBasis[i] + multKC * atr[i]);
      kcLower.push(kcBasis[i] - multKC * atr[i]);
    }
  }

  const squeezeOn = [];
  for (let i = 0; i < size; i++) {
    if (bbLower[i] === null || kcLower[i] === null) {
      squeezeOn.push(false);
    } else {
      squeezeOn.push(bbLower[i] > kcLower[i] && bbUpper[i] < kcUpper[i]);
    }
  }

  const delta = [];
  for (let i = 0; i < size; i++) {
    if (i < lengthKC - 1 || kcBasis[i] === null) {
      delta.push(null);
    } else {
      let maxHigh = -Infinity;
      let minLow = Infinity;
      for (let j = 0; j < lengthKC; j++) {
        if (high[i - j] > maxHigh) maxHigh = high[i - j];
        if (low[i - j] < minLow) minLow = low[i - j];
      }
      const donchianMid = (maxHigh + minLow) / 2;
      delta.push(close[i] - (kcBasis[i] + donchianMid) / 2);
    }
  }

  const histogram = new Array(size).fill(null);
  const N = lengthKC;
  const sumX = (N * (N - 1)) / 2;
  const sumX2 = ((N - 1) * N * (2 * N - 1)) / 6;
  const denom = N * sumX2 - Math.pow(sumX, 2);

  for (let i = lengthKC - 1; i < size; i++) {
    if (delta[i] === null) continue;

    let sumY = 0;
    let sumXY = 0;
    let valid = true;
    for (let x = 0; x < N; x++) {
      const yVal = delta[i - (N - 1 - x)];
      if (yVal === null) {
        valid = false;
        break;
      }
      sumY += yVal;
      sumXY += x * yVal;
    }

    if (valid) {
      const slope = (N * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / N;
      histogram[i] = Number((slope * (N - 1) + intercept).toFixed(4));
    }
  }

  return { histogram, squeezeOn };
}

// ══════════════════════════════════════════════════════════════
// 13. SMC DETECTION (BOS/CHoCH/FVG)
// ══════════════════════════════════════════════════════════════
export function detectSMC(candles, settings) {
  const size = candles.length;
  const swingLookback = settings.smc.swingLookback || 4;
  const swings = [];
  const breaks = [];
  const fvgs = [];

  if (size < swingLookback * 2 + 1) return { swings, breaks, fvgs };

  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const close = candles.map(c => c.close);

  let lastSwingHigh = null;
  let lastSwingLow = null;

  for (let i = swingLookback; i < size - swingLookback; i++) {
    let isSwingHigh = true;
    for (let j = 1; j <= swingLookback; j++) {
      if (high[i] <= high[i - j] || high[i] <= high[i + j]) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      lastSwingHigh = { price: high[i], index: i, time: candles[i].time };
      swings.push({ type: 'high', price: high[i], index: i });
    }

    let isSwingLow = true;
    for (let j = 1; j <= swingLookback; j++) {
      if (low[i] >= low[i - j] || low[i] >= low[i + j]) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      lastSwingLow = { price: low[i], index: i, time: candles[i].time };
      swings.push({ type: 'low', price: low[i], index: i });
    }

    if (settings.smc.showBOS) {
      if (lastSwingHigh && close[i] > lastSwingHigh.price) {
        breaks.push({
          type: 'bullish',
          price: lastSwingHigh.price,
          time: candles[i].time,
          label: 'Bullish BOS'
        });
        lastSwingHigh = null;
      }

      if (lastSwingLow && close[i] < lastSwingLow.price) {
        breaks.push({
          type: 'bearish',
          price: lastSwingLow.price,
          time: candles[i].time,
          label: 'Bearish BOS'
        });
        lastSwingLow = null;
      }
    }
  }

  if (settings.smc.showFVG) {
    for (let i = 2; i < size; i++) {
      if (low[i] > high[i - 2]) {
        fvgs.push({
          type: 'bullish',
          price: (low[i] + high[i - 2]) / 2,
          label: 'Bullish FVG'
        });
      }
      if (high[i] < low[i - 2]) {
        fvgs.push({
          type: 'bearish',
          price: (high[i] + low[i - 2]) / 2,
          label: 'Bearish FVG'
        });
      }
    }
  }

  return { swings, breaks, fvgs };
}

// ══════════════════════════════════════════════════════════════
// 14. AI FORECAST (KNN PATTERN PROJECTION)
//     Searches historical data for K nearest neighbors to the 
//     current pattern and averages their forward trajectories
// ══════════════════════════════════════════════════════════════
export function calculateKNNProjection(candles, lookback = 14, forward = 10, k = 5) {
  const n = candles.length;
  if (n < lookback + forward) return { projection: [] };

  const close = candles.map(c => c.close);
  
  // Extract the current pattern (last 'lookback' candles)
  const currentPattern = close.slice(n - lookback, n);
  
  // Normalize a pattern so its first value is 0 (relative percentage change)
  const normalize = (arr) => {
    const base = arr[0];
    return arr.map(val => (val - base) / base);
  };
  
  const currentNorm = normalize(currentPattern);
  
  // Array to store similarities: { index, distance }
  const distances = [];
  
  // Search history for similar patterns
  // We stop at n - lookback - forward so we have enough future data to project
  for (let i = 0; i < n - lookback - forward - 1; i++) {
    const histPattern = close.slice(i, i + lookback);
    const histNorm = normalize(histPattern);
    
    // Calculate Euclidean distance
    let dist = 0;
    for (let j = 0; j < lookback; j++) {
      dist += Math.pow(currentNorm[j] - histNorm[j], 2);
    }
    dist = Math.sqrt(dist);
    
    distances.push({ index: i, distance: dist });
  }
  
  // Sort by distance ascending (closest neighbors first)
  distances.sort((a, b) => a.distance - b.distance);
  
  // Take top K
  const topK = distances.slice(0, k);
  
  // Calculate average forward trajectory
  // We look at the 'forward' candles AFTER the historical pattern matched
  const forwardTrajectoriesNorm = [];
  
  for (let neighbor of topK) {
    const idx = neighbor.index;
    const endOfPatternIdx = idx + lookback - 1;
    const basePrice = close[endOfPatternIdx];
    
    const traj = [];
    for (let f = 1; f <= forward; f++) {
      // Relative change from the end of the historical pattern
      const futurePrice = close[endOfPatternIdx + f];
      traj.push((futurePrice - basePrice) / basePrice);
    }
    forwardTrajectoriesNorm.push(traj);
  }
  
  // Average the normalized trajectories
  const avgTrajNorm = [];
  for (let f = 0; f < forward; f++) {
    let sum = 0;
    for (let t = 0; t < k; t++) {
      sum += forwardTrajectoriesNorm[t][f];
    }
    avgTrajNorm.push(sum / k);
  }
  
  // Denormalize the average trajectory starting from the current CURRENT price
  const currentPrice = close[n - 1];
  const projection = [];
  
  // The first point of the projection connects to the current price
  projection.push(currentPrice);
  
  for (let f = 0; f < forward; f++) {
    // apply the average relative change to the current price
    projection.push(currentPrice * (1 + avgTrajNorm[f]));
  }
  
  return { projection };
}
