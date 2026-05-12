import { indicatorRegistry, SMA, EMA, RSI, MACD, BollingerBands, ATR } from "./indicators.js";

/**
 * Runs a backtest given candles and a strategy defined as code string.
 *
 * RISK MODEL:
 * Every trade MUST have a stop loss. Position size is calculated as:
 *   size = riskPerTrade / |entryPrice - stopLoss|
 * This means if stop loss is hit, you lose exactly $riskPerTrade.
 * If price hits your take-profit or strategy closes, you win/lose
 * proportionally based on that same size.
 *
 * Strategy signals must return: { action, stopLoss, takeProfit? }
 *
 * @param {Array} candles - OHLCV candles
 * @param {string} strategyCode - JavaScript strategy code as string
 * @param {object} userParams - { riskPerTrade, ...strategyParams }
 * @returns {{ trades, equity, summary }}
 */
export function runBacktest(candles, strategyCode, userParams = {}) {
  const {
    riskPerTrade = 100,     // $ lost when stop loss is hit
    initialCapital = 10000, // Starting balance
    ...strategyParams       // Everything else goes to the strategy
  } = userParams;

  const strategy = buildStrategy(strategyCode, strategyParams);
  const closes = candles.map((c) => c.close);

  // Let the strategy pre-compute indicators
  const indicators = {};
  if (strategy.init) {
    strategy.init({
      candles, closes, indicators,
      SMA, EMA, RSI, MACD, BollingerBands, ATR,
    });
  }

  // Simulation state
  let capital = initialCapital;
  let position = null; // { side, entryPrice, stopLoss, takeProfit, size, entryTime }
  const trades = [];
  const equity = [{ time: candles[0].time, value: capital }];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // ── 1. Check stop loss / take profit FIRST (before new signals) ──
    if (position) {
      const exitResult = checkStopAndTarget(position, candle);
      if (exitResult) {
        const pnl = calcPnl(position, exitResult.price);
        capital += pnl;
        trades.push({
          side: position.side,
          entryPrice: position.entryPrice,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit || null,
          exitPrice: exitResult.price,
          exitReason: exitResult.reason, // "stop_loss", "take_profit", or "signal"
          entryTime: position.entryTime,
          exitTime: candle.time,
          size: round(position.size),
          riskAmount: riskPerTrade,
          pnl: round(pnl),
          rMultiple: round(pnl / riskPerTrade, 2), // P&L as multiple of risk
          capitalAfter: round(capital),
        });
        position = null;
      }
    }

    // ── 2. Build indicator snapshot for this bar ──
    const snap = {};
    for (const [key, arr] of Object.entries(indicators)) {
      if (Array.isArray(arr)) {
        snap[key] = arr[i];
      } else if (typeof arr === "object") {
        snap[key] = {};
        for (const [sub, subArr] of Object.entries(arr)) {
          snap[key][sub] = subArr[i];
        }
      }
    }

    // ── 3. Ask the strategy what to do ──
    const signal = strategy.onCandle({
      index: i,
      candle,
      candles: candles.slice(0, i + 1),
      indicators: snap,
      position: position
        ? { ...position, unrealizedPnl: calcPnl(position, candle.close) }
        : null,
      capital,
      riskPerTrade,
    });

    if (!signal) {
      // no action
    }
    // ── Open a new position ──
    else if ((signal.action === "buy" || signal.action === "sell") && !position) {
      // REQUIRE a stop loss — skip the trade if none provided
      if (signal.stopLoss == null) {
        console.warn(`Bar ${i}: Signal without stopLoss ignored. Every trade needs a stop loss.`);
      } else {
        const entry = candle.close;
        const sl = signal.stopLoss;
        const slDistance = Math.abs(entry - sl);

        if (slDistance === 0) {
          console.warn(`Bar ${i}: Stop loss equals entry price, skipping.`);
        } else {
          // CORE FORMULA: size = risk$ / distance-to-stop
          const size = riskPerTrade / slDistance;

          position = {
            side: signal.action === "buy" ? "long" : "short",
            entryPrice: entry,
            stopLoss: sl,
            takeProfit: signal.takeProfit || null,
            size,
            entryTime: candle.time,
          };
        }
      }
    }
    // ── Strategy-driven close (not SL/TP) ──
    else if (signal.action === "close" && position) {
      const pnl = calcPnl(position, candle.close);
      capital += pnl;
      trades.push({
        side: position.side,
        entryPrice: position.entryPrice,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit || null,
        exitPrice: candle.close,
        exitReason: "signal",
        entryTime: position.entryTime,
        exitTime: candle.time,
        size: round(position.size),
        riskAmount: riskPerTrade,
        pnl: round(pnl),
        rMultiple: round(pnl / riskPerTrade, 2),
        capitalAfter: round(capital),
      });
      position = null;
    }
    // ── Move stop loss (trailing stop / break-even) ──
    else if (signal.action === "move_stop" && position && signal.stopLoss != null) {
      position.stopLoss = signal.stopLoss;
      if (signal.takeProfit != null) position.takeProfit = signal.takeProfit;
    }

    // Track equity curve
    const unrealized = position ? calcPnl(position, candle.close) : 0;
    equity.push({ time: candle.time, value: round(capital + unrealized) });
  }

  // Force-close any open position at end of data
  if (position) {
    const lastPrice = candles[candles.length - 1].close;
    const pnl = calcPnl(position, lastPrice);
    capital += pnl;
    trades.push({
      side: position.side,
      entryPrice: position.entryPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit || null,
      exitPrice: lastPrice,
      exitReason: "end_of_data",
      entryTime: position.entryTime,
      exitTime: candles[candles.length - 1].time,
      size: round(position.size),
      riskAmount: riskPerTrade,
      pnl: round(pnl),
      rMultiple: round(pnl / riskPerTrade, 2),
      capitalAfter: round(capital),
    });
  }

  // Summary stats
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const slHits = trades.filter((t) => t.exitReason === "stop_loss");
  const tpHits = trades.filter((t) => t.exitReason === "take_profit");

  const summary = {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? round((wins.length / trades.length) * 100) : 0,
    totalPnl: round(trades.reduce((s, t) => s + t.pnl, 0)),
    avgWin: wins.length ? round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0,
    avgLoss: losses.length ? round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0,
    avgRMultiple: trades.length ? round(trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length, 2) : 0,
    bestR: trades.length ? round(Math.max(...trades.map((t) => t.rMultiple)), 2) : 0,
    worstR: trades.length ? round(Math.min(...trades.map((t) => t.rMultiple)), 2) : 0,
    stopLossHits: slHits.length,
    takeProfitHits: tpHits.length,
    signalExits: trades.filter((t) => t.exitReason === "signal").length,
    maxDrawdown: calcMaxDrawdown(equity),
    finalCapital: round(capital),
    returnPct: round(((capital - initialCapital) / initialCapital) * 100),
    riskPerTrade,
  };

  return { trades, equity, summary };
}

/**
 * Checks if the current candle's high/low hit the stop loss or take profit.
 * Stop loss is checked BEFORE take profit (worst-case assumption).
 */
function checkStopAndTarget(pos, candle) {
  if (pos.side === "long") {
    // Stop loss: price went below SL
    if (candle.low <= pos.stopLoss) {
      return { price: pos.stopLoss, reason: "stop_loss" };
    }
    // Take profit: price went above TP
    if (pos.takeProfit && candle.high >= pos.takeProfit) {
      return { price: pos.takeProfit, reason: "take_profit" };
    }
  } else {
    // Short stop loss: price went above SL
    if (candle.high >= pos.stopLoss) {
      return { price: pos.stopLoss, reason: "stop_loss" };
    }
    // Short take profit: price went below TP
    if (pos.takeProfit && candle.low <= pos.takeProfit) {
      return { price: pos.takeProfit, reason: "take_profit" };
    }
  }
  return null;
}

function calcPnl(position, currentPrice) {
  if (position.side === "long") {
    return (currentPrice - position.entryPrice) * position.size;
  }
  return (position.entryPrice - currentPrice) * position.size;
}

function calcMaxDrawdown(equity) {
  let peak = -Infinity, maxDd = 0;
  for (const pt of equity) {
    if (pt.value > peak) peak = pt.value;
    const dd = ((peak - pt.value) / peak) * 100;
    if (dd > maxDd) maxDd = dd;
  }
  return round(maxDd);
}

function round(v, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/**
 * Safely builds a strategy object from user code string.
 * The code runs in a Function() sandbox with indicator access.
 */
function buildStrategy(code, params) {
  const fn = new Function(
    "SMA", "EMA", "RSI", "MACD", "BollingerBands", "ATR", "params",
    `${code}\n return strategy;`
  );
  return fn(SMA, EMA, RSI, MACD, BollingerBands, ATR, params);
}