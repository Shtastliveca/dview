import React from "react";

const input = {
  background: "#1a1a24", border: "1px solid #3a3a48", color: "#e1e1e6",
  borderRadius: 4, padding: "4px 8px", width: "100%", boxSizing: "border-box",
};

export default function BacktestPanel({
  riskPerTrade, setRiskPerTrade,
  initialCapital, setInitialCapital,
  candleLimit, setCandleLimit,
  onRun, loading, summary,
}) {
  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Backtest Settings</h3>

      <label style={{ fontSize: 12, color: "#9a9aad" }}>Risk per trade ($)</label>
      <input type="number" value={riskPerTrade}
        onChange={(e) => setRiskPerTrade(Number(e.target.value))} style={{ ...input, marginBottom: 8 }} />

      <label style={{ fontSize: 12, color: "#9a9aad" }}>Initial capital ($)</label>
      <input type="number" value={initialCapital}
        onChange={(e) => setInitialCapital(Number(e.target.value))} style={{ ...input, marginBottom: 8 }} />

      <label style={{ fontSize: 12, color: "#9a9aad" }}>Candles to fetch</label>
      <input type="number" value={candleLimit}
        onChange={(e) => setCandleLimit(Number(e.target.value))} style={{ ...input, marginBottom: 12 }} />

      <button onClick={onRun} disabled={loading}
        style={{ width: "100%", padding: "8px 0", background: loading ? "#444" : "#2d5af7",
          color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>
        {loading ? "Running..." : "Run Backtest"}
      </button>

      {summary && (
        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.8, color: "#c8c8d0" }}>
          <div>Trades: <b>{summary.totalTrades}</b> | Win rate: <b>{summary.winRate}%</b></div>
          <div>Total P&L: <b style={{ color: summary.totalPnl >= 0 ? "#26a69a" : "#ef5350" }}>
            ${summary.totalPnl}</b></div>
          <div>Avg win: <b>${summary.avgWin}</b> | Avg loss: <b>${summary.avgLoss}</b></div>
          <div>Avg R: <b style={{ color: summary.avgRMultiple >= 0 ? "#26a69a" : "#ef5350" }}>
            {summary.avgRMultiple}R</b> | Best: <b>{summary.bestR}R</b> | Worst: <b>{summary.worstR}R</b></div>
          <div style={{ color: "#6a6a7a" }}>
            Exits — SL: {summary.stopLossHits} | TP: {summary.takeProfitHits} | Signal: {summary.signalExits}
            {summary.conflictsResolved > 0 && (
              <span> | Drill-downs: {summary.conflictsResolved}</span>
            )}
          </div>
          <div>Max drawdown: <b>{summary.maxDrawdown}%</b></div>
          <div>Final capital: <b>${summary.finalCapital}</b> ({summary.returnPct}%)</div>
          <div style={{ color: "#6a6a7a", fontSize: 11 }}>Risk per trade: ${summary.riskPerTrade}</div>
        </div>
      )}
    </div>
  );
}