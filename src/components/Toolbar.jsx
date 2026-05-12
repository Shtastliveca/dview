import React from "react";

const btn = {
  padding: "6px 14px", background: "#1e1e2a", color: "#c8c8d0",
  border: "1px solid #3a3a48", borderRadius: 4, cursor: "pointer", fontSize: 13,
};
const activeBtn = { ...btn, background: "#2d5af7", color: "#fff", borderColor: "#2d5af7" };

export default function Toolbar({
  symbols, symbol, onSymbolChange,
  timeframes, interval, onIntervalChange,
  onToggleEditor, onToggleIndicators,
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
      background: "#16161e", borderBottom: "1px solid #2a2a35", flexWrap: "wrap" }}>

      <select value={symbol} onChange={(e) => onSymbolChange(e.target.value)}
        style={{ ...btn, minWidth: 100 }}>
        {symbols.map((s) => (
          <option key={s.name} value={s.name}>{s.name}</option>
        ))}
        {/* Fallback if symbols haven't loaded yet */}
        {symbols.length === 0 && <option value="BTC">BTC</option>}
      </select>

      <div style={{ display: "flex", gap: 2 }}>
        {timeframes.map((tf) => (
          <button key={tf} onClick={() => onIntervalChange(tf)}
            style={interval === tf ? activeBtn : btn}>
            {tf}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={onToggleIndicators} style={btn}>Indicators</button>
      <button onClick={onToggleEditor} style={btn}>Strategy</button>
    </div>
  );
}