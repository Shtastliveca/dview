import React from "react";

const th = {
  padding: "6px 10px", textAlign: "left", fontSize: 11, color: "#6a6a7a",
  borderBottom: "1px solid #2a2a35", fontWeight: 600,
};
const td = {
  padding: "5px 10px", fontSize: 12, borderBottom: "1px solid #1e1e2a",
};

export default function TradeList({ trades, summary, onSendSignal }) {
  if (!trades || trades.length === 0) return null;

  const reasonLabel = { stop_loss: "SL", take_profit: "TP", signal: "Signal", end_of_data: "EOD" };
  const reasonColor = { stop_loss: "#ef5350", take_profit: "#26a69a", signal: "#c8c8d0", end_of_data: "#6a6a7a" };

  return (
    <div style={{ maxHeight: 220, overflowY: "auto", borderTop: "1px solid #2a2a35" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "#16161e" }}>
            <th style={th}>#</th>
            <th style={th}>Side</th>
            <th style={th}>Entry</th>
            <th style={th}>SL</th>
            <th style={th}>Exit</th>
            <th style={th}>Reason</th>
            <th style={th}>P&L</th>
            <th style={th}>R</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, color: t.side === "long" ? "#26a69a" : "#ef5350" }}>
                {t.side.toUpperCase()}
              </td>
              <td style={td}>{t.entryPrice.toFixed(2)}</td>
              <td style={td}>{t.stopLoss.toFixed(2)}</td>
              <td style={td}>{t.exitPrice.toFixed(2)}</td>
              <td style={{ ...td, color: reasonColor[t.exitReason] || "#c8c8d0" }}>
                {reasonLabel[t.exitReason] || t.exitReason}
                {t.resolvedVia && (
                  <span title={`Resolved by checking ${t.resolvedVia} candles`}
                    style={{ marginLeft: 4, fontSize: 9, color: "#6a6a7a" }}>
                    ({t.resolvedVia})
                  </span>
                )}
              </td>
              <td style={{ ...td, color: t.pnl >= 0 ? "#26a69a" : "#ef5350", fontWeight: 600 }}>
                {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
              </td>
              <td style={{ ...td, color: t.rMultiple >= 0 ? "#26a69a" : "#ef5350" }}>
                {t.rMultiple >= 0 ? "+" : ""}{t.rMultiple}R
              </td>
              <td style={td}>
                <button onClick={() => onSendSignal(t)}
                  style={{ background: "none", border: "1px solid #3a3a48",
                    color: "#9a9aad", borderRadius: 3, padding: "2px 6px",
                    cursor: "pointer", fontSize: 11 }}>
                  Signal
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}