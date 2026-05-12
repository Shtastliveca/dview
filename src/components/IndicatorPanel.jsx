import React, { useState } from "react";

const COLORS = ["#2d5af7", "#f7a12d", "#a12df7", "#2df7a1", "#f72d5a"];

const field = {
  background: "#1a1a24", border: "1px solid #3a3a48", color: "#e1e1e6",
  borderRadius: 4, padding: "4px 8px", width: 60,
};

export default function IndicatorPanel({ overlays, setOverlays }) {
  const [type, setType] = useState("SMA");
  const [period, setPeriod] = useState(20);

  function addOverlay() {
    setOverlays([...overlays, {
      id: Date.now(),
      type,
      period: Number(period),
      color: COLORS[overlays.length % COLORS.length],
    }]);
  }

  function removeOverlay(id) {
    setOverlays(overlays.filter((o) => o.id !== id));
  }

  return (
    <div style={{ padding: 12, borderBottom: "1px solid #2a2a35" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Indicators</h3>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={field}>
          <option>SMA</option>
          <option>EMA</option>
        </select>
        <input type="number" value={period} onChange={(e) => setPeriod(e.target.value)}
          style={field} placeholder="Period" />
        <button onClick={addOverlay} style={{
          padding: "5px 12px", background: "#2d5af7", color: "#fff",
          border: "none", borderRadius: 4, cursor: "pointer",
        }}>Add</button>
      </div>

      {overlays.map((o) => (
        <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: o.color, display: "inline-block" }} />
          <span style={{ fontSize: 13 }}>{o.type}({o.period})</span>
          <button onClick={() => removeOverlay(o.id)}
            style={{ marginLeft: "auto", background: "none", border: "none",
              color: "#ef5350", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      ))}

      {overlays.length === 0 && (
        <p style={{ color: "#6a6a7a", fontSize: 12, margin: 0 }}>
          No indicators added yet. RSI/MACD support coming soon as separate panes.
        </p>
      )}
    </div>
  );
}