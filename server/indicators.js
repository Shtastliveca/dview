// ─── Core Indicator Functions ────────────────────────────────
// Each takes an array of candles and returns an array of values
// (same length as input, with NaN for insufficient-data bars).

export function SMA(closes, period) {
  const result = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result[i] = sum / period;
  }
  return result;
}

export function EMA(closes, period) {
  const result = new Array(closes.length).fill(NaN);
  const k = 2 / (period + 1);
  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  result[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function RSI(closes, period = 14) {
  const result = new Array(closes.length).fill(NaN);
  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) avgGain += delta; else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (delta < 0 ? -delta : 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function MACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = EMA(closes, fast);
  const emaSlow = EMA(closes, slow);
  const macdLine = closes.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  );
  // Signal line = EMA of MACD line (skip NaN values)
  const validMacd = macdLine.map((v) => (isNaN(v) ? 0 : v));
  const signalLine = EMA(validMacd, signal);
  const histogram = macdLine.map((v, i) =>
    isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i]
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

export function BollingerBands(closes, period = 20, mult = 2) {
  const sma = SMA(closes, period);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - sma[i]) ** 2;
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = sma[i] + mult * std;
    lower[i] = sma[i] - mult * std;
  }
  return { middle: sma, upper, lower };
}

export function ATR(candles, period = 14) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return SMA(tr, period); // Simple ATR using SMA smoothing
}

// Registry: maps names to functions so strategies can call them
export const indicatorRegistry = {
  SMA, EMA, RSI, MACD, BollingerBands, ATR,
};