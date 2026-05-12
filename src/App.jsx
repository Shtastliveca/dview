import React, { useState, useEffect, useRef } from "react";
import { getSymbols, getCandles, runBacktest, sendSignal, checkAuthRequired, login } from "./api.js";
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

// ─── Password Gate ───────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(pw);
      onLogin();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0f0f14", fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ background: "#16161e", padding: 32,
        borderRadius: 8, border: "1px solid #2a2a35", minWidth: 300 }}>
        <h2 style={{ color: "#e1e1e6", margin: "0 0 16px", fontSize: 18 }}>Trading Platform</h2>
        <input
          type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="Password" autoFocus
          style={{ width: "100%", padding: "8px 12px", background: "#1a1a24",
            border: "1px solid #3a3a48", borderRadius: 4, color: "#e1e1e6",
            fontSize: 14, boxSizing: "border-box", marginBottom: 12 }}
        />
        {error && <div style={{ color: "#ef5350", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ width: "100%", padding: "8px 0", background: "#2d5af7", color: "#fff",
            border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "Enter"}
        </button>
      </form>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────
export default function App() {
  // Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authed, setAuthed] = useState(false);

  // Check if password is required on mount
  useEffect(() => {
    checkAuthRequired().then((required) => {
      setNeedsAuth(required);
      setAuthed(!required);
      setAuthChecked(true);
    }).catch(() => {
      setAuthed(true); // if check fails, let them in
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) return null; // loading
  if (needsAuth && !authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  return <Dashboard />;
}

function Dashboard() {
  const [symbols, setSymbols] = useState([]);
  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [overlays, setOverlays] = useState([]);

  const [strategyCode, setStrategyCode] = useState(DEFAULT_STRATEGY);
  const [riskPerTrade, setRiskPerTrade] = useState(100);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [candleLimit, setCandleLimit] = useState(10000);
  const [btResult, setBtResult] = useState(null);
  const [btLoading, setBtLoading] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);

  // WebSocket ref for live updates
  const wsRef = useRef(null);

  // Load symbols
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

  // ─── WebSocket: live candle updates ────────────────────
  useEffect(() => {
    // Connect to our server's WS proxy
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", symbol, interval }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "candle" && msg.candle) {
          setCandles((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            if (msg.candle.time === last.time) {
              // Update the current candle
              return [...prev.slice(0, -1), msg.candle];
            } else if (msg.candle.time > last.time) {
              // New candle
              return [...prev, msg.candle];
            }
            return prev;
          });
        }
      } catch {}
    };

    ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          // trigger re-subscribe by re-running this effect
        }
      }, 3000);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
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
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
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

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left side: Chart + Trades — minWidth:0 lets it shrink properly */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
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
        {(showEditor || showIndicators) && (
          <div style={{ width: 420, flexShrink: 0, borderLeft: "1px solid #2a2a35",
            display: "flex", flexDirection: "column", overflow: "auto" }}>

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
        )}
      </div>
    </div>
  );
}