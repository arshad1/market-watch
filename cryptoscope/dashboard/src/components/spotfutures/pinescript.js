/**
 * Simple client-side Pine Script Interpreter for CryptoScope
 */

export function calculateSMA(series, length) {
  const result = [];
  for (let i = 0; i < series.length; i++) {
    if (i < length - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < length; j++) {
        sum += series[i - j];
      }
      result.push(Number((sum / length).toFixed(4)));
    }
  }
  return result;
}

export function calculateEMA(series, length) {
  const result = [];
  const multiplier = 2 / (length + 1);
  let prevEma = null;

  for (let i = 0; i < series.length; i++) {
    if (i < length - 1) {
      result.push(null);
    } else if (i === length - 1) {
      let sum = 0;
      for (let j = 0; j < length; j++) {
        sum += series[j];
      }
      prevEma = sum / length;
      result.push(Number(prevEma.toFixed(4)));
    } else {
      const currentVal = series[i];
      const ema = (currentVal - prevEma) * multiplier + prevEma;
      prevEma = ema;
      result.push(Number(ema.toFixed(4)));
    }
  }
  return result;
}

export function calculateRSI(series, length) {
  const result = [];
  if (series.length <= length) {
    return new Array(series.length).fill(null);
  }

  const gains = [];
  const losses = [];
  for (let i = 1; i < series.length; i++) {
    const diff = series[i] - series[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  // Populate first elements with null
  for (let i = 0; i <= length; i++) {
    result.push(null);
  }

  // First average gain and loss (simple average)
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 0; i < length; i++) {
    gainSum += gains[i];
    lossSum += losses[i];
  }
  let avgGain = gainSum / length;
  let avgLoss = lossSum / length;

  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result[length] = Number(firstRsi.toFixed(4));

  // Wilder's smoothing
  for (let i = length; i < gains.length; i++) {
    avgGain = (avgGain * (length - 1) + gains[i]) / length;
    avgLoss = (avgLoss * (length - 1) + losses[i]) / length;

    const rsiVal = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push(Number(rsiVal.toFixed(4)));
  }

  return result;
}

function mapColorName(colorName) {
  const mapping = {
    blue: '#3b82f6',
    red: '#ef4444',
    green: '#10b981',
    yellow: '#f59e0b',
    purple: '#8b5cf6',
    orange: '#f97316',
    teal: '#14b8a6',
    white: '#ffffff',
    gray: '#94a3b8',
    black: '#000000'
  };
  return mapping[colorName.toLowerCase()] || colorName;
}

function parseArgs(argsStr) {
  const args = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  args.push(current.trim());
  return args.filter(Boolean);
}

function evaluateExpression(expr, variables, size) {
  expr = expr.trim();

  // 1. Literal number
  if (/^\d+(\.\d+)?$/.test(expr)) {
    return new Array(size).fill(Number(expr));
  }

  // 2. Simple variable
  if (variables[expr] !== undefined) {
    return variables[expr];
  }

  // 3. Function call
  const fnMatch = expr.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const args = parseArgs(fnMatch[2]);

    if (fnName === 'sma') {
      const src = evaluateExpression(args[0], variables, size);
      const len = parseInt(args[1]);
      if (isNaN(len)) throw new Error(`Invalid length for sma: "${args[1]}"`);
      return calculateSMA(src, len);
    }

    if (fnName === 'ema') {
      const src = evaluateExpression(args[0], variables, size);
      const len = parseInt(args[1]);
      if (isNaN(len)) throw new Error(`Invalid length for ema: "${args[1]}"`);
      return calculateEMA(src, len);
    }

    if (fnName === 'rsi') {
      const src = evaluateExpression(args[0], variables, size);
      const len = parseInt(args[1]);
      if (isNaN(len)) throw new Error(`Invalid length for rsi: "${args[1]}"`);
      return calculateRSI(src, len);
    }

    throw new Error(`Unknown function: "${fnName}"`);
  }

  // 4. Binary Math Operations (+ - * /)
  const binMatch = expr.match(/^([a-zA-Z0-9_.\(\)\s]+)\s*([\+\-\*/])\s*([a-zA-Z0-9_.\(\)\s]+)$/);
  if (binMatch) {
    const left = evaluateExpression(binMatch[1], variables, size);
    const op = binMatch[2];
    const right = evaluateExpression(binMatch[3], variables, size);

    const result = [];
    for (let i = 0; i < size; i++) {
      const lVal = left[i];
      const rVal = right[i];
      if (lVal === null || rVal === null) {
        result.push(null);
      } else {
        if (op === '+') result.push(lVal + rVal);
        else if (op === '-') result.push(lVal - rVal);
        else if (op === '*') result.push(lVal * rVal);
        else if (op === '/') result.push(rVal === 0 ? null : lVal / rVal);
      }
    }
    return result;
  }

  throw new Error(`Could not parse expression: "${expr}"`);
}

export function parseAndExecutePine(scriptText, candles) {
  const size = candles.length;
  const close = candles.map(c => c.close);
  const open = candles.map(c => c.open);
  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const volume = candles.map(c => c.volume);

  const variables = { close, open, high, low, volume };
  const plots = [];
  const errors = [];

  if (!scriptText || !scriptText.trim()) {
    return { plots, errors };
  }

  const lines = scriptText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('//') || rawLine.startsWith('@')) {
      continue;
    }

    try {
      // Check assignment: variable = expression
      const assignMatch = rawLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (assignMatch) {
        const varName = assignMatch[1].trim();
        const exprStr = assignMatch[2].trim();
        const resultSeries = evaluateExpression(exprStr, variables, size);
        variables[varName] = resultSeries;
        continue;
      }

      // Check plot statement: plot(expr, ...)
      const plotMatch = rawLine.match(/^plot\s*\((.+)\)$/);
      if (plotMatch) {
        const plotArgs = parseArgs(plotMatch[1]);
        if (plotArgs.length === 0) throw new Error('plot() requires at least one argument');
        
        const exprStr = plotArgs[0];
        const series = evaluateExpression(exprStr, variables, size);

        let color = '#3b82f6';
        let title = exprStr;

        for (let j = 1; j < plotArgs.length; j++) {
          const arg = plotArgs[j].trim();
          if (arg.includes('=')) {
            const [k, v] = arg.split('=').map(s => s.trim());
            const valClean = v.replace(/['"]/g, '');
            if (k === 'color') {
              if (valClean.startsWith('color.')) {
                color = mapColorName(valClean.split('.')[1]);
              } else {
                color = valClean;
              }
            } else if (k === 'title') {
              title = valClean;
            }
          } else {
            // Positional check
            if (j === 1) {
              if (arg.startsWith('color.') || arg.startsWith('#')) {
                color = mapColorName(arg.replace('color.', ''));
              } else {
                title = arg.replace(/['"]/g, '');
              }
            }
          }
        }

        plots.push({
          title,
          color,
          series
        });
        continue;
      }

      // Skip config definitions
      if (rawLine.startsWith('indicator') || rawLine.startsWith('study')) {
        continue;
      }

      throw new Error(`Invalid line statement: "${rawLine}"`);
    } catch (err) {
      errors.push(`Line ${lineNum}: ${err.message}`);
    }
  }

  return { plots, errors };
}
