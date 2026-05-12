// ─── SMA Crossover Strategy (with proper risk management) ──
// Every trade MUST return a stopLoss. The engine calculates position size as:
//   size = riskPerTrade / |entryPrice - stopLoss|
// So if your stop is hit, you lose exactly $riskPerTrade. No more, no less.

const strategy = {
  name: "SMA Crossover",

  init({ closes, candles, indicators, SMA, ATR }) {
    const fast = params.fastPeriod || 10;
    const slow = params.slowPeriod || 30;
    indicators.smaFast = SMA(closes, fast);
    indicators.smaSlow = SMA(closes, slow);
    indicators.atr = ATR(candles, 14); // for dynamic stop-loss placement
  },

  onCandle({ index, candle, indicators, position }) {
    const fast = indicators.smaFast;
    const slow = indicators.smaSlow;
    const atr = indicators.atr;

    if (isNaN(fast) || isNaN(slow) || isNaN(atr)) return null;

    // Fast crosses above slow → go long
    if (fast > slow && !position) {
      return {
        action: "buy",
        stopLoss: candle.close - atr * 1.5,     // stop 1.5× ATR below entry
        takeProfit: candle.close + atr * 3,       // target 3× ATR above (2:1 R:R)
      };
    }

    // Fast crosses below slow → close the long
    if (fast < slow && position && position.side === "long") {
      return { action: "close" };
    }

    // Optional: trail the stop to break-even once in profit
    if (position && position.side === "long") {
      const profitSoFar = candle.close - position.entryPrice;
      if (profitSoFar > atr * 1.5 && position.stopLoss < position.entryPrice) {
        return { action: "move_stop", stopLoss: position.entryPrice };
      }
    }

    return null;
  },
};