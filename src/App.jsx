import React, { useState, useEffect, useRef } from "react";
import { getSymbols, getCandles, runBacktest, sendSignal } from "./api.js";
import Chart from "./components/Chart.jsx";
import Toolbar from "./components/Toolbar.jsx";
import IndicatorPanel from "./components/IndicatorPanel.jsx";
import StrategyEditor from "./components/StrategyEditor.jsx";
import BacktestPanel from "./components/BacktestPanel.jsx";
import TradeList from "./components/TradeList.jsx";

const TIMEFRAMES = ["1m","5m","15m","30m","1h","2h","4h","6h","12h","1d","3d","1w"];

const DEFAULT_STRATEGY = `const strategy = {
  name: "SMA Crossover",
  init({ closes, candles, indicators, SMA, ATR }) {
    indicators.smaFast = SMA(closes, params.fastPeriod || 10);
    indicators.smaSlow = SMA(closes, params.slowPeriod || 30);
    indicators.atr = ATR(candles, 14);
  },
  onCandle({ candle, indicators, position }) {
    const fast = indicators.smaFast;
    const slow = indicators.smaSlow;
    const atr = indicators.atr;
    if (isNaN(fast) || isNaN(slow) || isNaN(atr)) return null;

    if (fast > slow && !position) {
      return {
        action: "buy",
        stopLoss: candle.close - atr * 1.5,
        takeProfit: candle.close + atr * 3,
      };
    }
    if (fast < slow && position?.side === "long") {
      return { action: "close" };
    }
    return null;
  },
};`;

export default function App() {
  const [symbols, setSymbols] = useState([]);
  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);

  // Indicators shown on chart
  const [overlays, setOverlays] = useState([]);

  // Backtest state
  const [strategyCode, setStrategyCode] = useState(DEFAULT_STRATEGY);
  const [riskPerTrade, setRiskPerTrade] = useState(100);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [candleLimit, setCandleLimit] = useState(1000);
  const [btResult, setBtResult] = useState(null);
  const [btLoading, setBtLoading] = useState(false);

  // Panels
  const [showEditor, setShowEditor] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);

  // Load symbols on mount
  useEffect(() => {
    getSymbols().then(setSymbols).catch(console.error);
  }, []);

  // Load candles when symbol or timeframe changes
  useEffect(() => {
    setLoading(true);
    getCandles(symbol, interval, 500)
      .then((data) => { setCandles(data); setLoading(false); })
      .catch((e) => { console.error(e); setLoading(false); });
  }, [symbol, interval]);

  async function handleBacktest() {
    setBtLoading(true);
    try {
      const result = await runBacktest({
        symbol, interval,
        limit: candleLimit,
        strategyCode,
        params: { riskPerTrade, initialCapital },
      });
      setBtResult(result);
    } catch (e) {
      alert("Backtest error: " + e.message);
    }
    setBtLoading(false);
  }

  async function handleSendSignal(trade) {
    try {
      await sendSignal({
        action: "open",
        symbol,
        side: trade.side,
        price: trade.entryPrice,
      });
      alert("Signal sent!");
    } catch (e) {
      alert("Signal error: " + e.message);
    }
  }

  const appStyle = {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: "#0f0f14",
    color: "#e1e1e6",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  };

  return (
    <div style={appStyle}>
      <Toolbar
        symbols={symbols}
        symbol={symbol}
        onSymbolChange={setSymbol}
        timeframes={TIMEFRAMES}
        interval={interval}
        onIntervalChange={setInterval}
        onToggleEditor={() => setShowEditor(!showEditor)}
        onToggleIndicators={() => setShowIndicators(!showIndicators)}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left side: Chart */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Chart
            candles={candles}
            overlays={overlays}
            trades={btResult?.trades || []}
            loading={loading}
          />

          {btResult && (
            <TradeList
              trades={btResult.trades}
              summary={btResult.summary}
              onSendSignal={handleSendSignal}
            />
          )}
        </div>

        {/* Right side panels */}
        <div style={{ width: showEditor || showIndicators ? 420 : 0, transition: "width 0.2s",
          overflow: "hidden", borderLeft: "1px solid #2a2a35", display: "flex", flexDirection: "column" }}>

          {showIndicators && (
            <IndicatorPanel overlays={overlays} setOverlays={setOverlays} />
          )}

          {showEditor && (
            <>
              <StrategyEditor code={strategyCode} onChange={setStrategyCode} />
              <BacktestPanel
                riskPerTrade={riskPerTrade}
                setRiskPerTrade={setRiskPerTrade}
                initialCapital={initialCapital}
                setInitialCapital={setInitialCapital}
                candleLimit={candleLimit}
                setCandleLimit={setCandleLimit}
                onRun={handleBacktest}
                loading={btLoading}
                summary={btResult?.summary}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}