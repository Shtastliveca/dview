import React, { useRef, useEffect } from "react";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";

export default function Chart({ candles, overlays, trades, loading }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const overlaySeriesRef = useRef([]); // to track and remove old overlays
  const markerRef = useRef(null);

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: "#0f0f14" }, textColor: "#9a9aad" },
      grid: {
        vertLines: { color: "#1e1e2a" },
        horzLines: { color: "#1e1e2a" },
      },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, borderColor: "#2a2a35" },
      rightPriceScale: { borderColor: "#2a2a35" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a", downColor: "#ef5350",
      borderUpColor: "#26a69a", borderDownColor: "#ef5350",
      wickUpColor: "#26a69a", wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Resize handler
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // Update candle data
  useEffect(() => {
    if (candleSeriesRef.current && candles.length) {
      candleSeriesRef.current.setData(candles);
      chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  // Update indicator overlays
  useEffect(() => {
    if (!chartRef.current || !candles.length) return;

    // Remove old overlay series
    overlaySeriesRef.current.forEach((s) => {
      try { chartRef.current.removeSeries(s); } catch {}
    });
    overlaySeriesRef.current = [];

    // Compute and add new overlays
    const closes = candles.map((c) => c.close);

    overlays.forEach((ov) => {
      let values;
      if (ov.type === "SMA") {
        values = computeSMA(closes, ov.period);
      } else if (ov.type === "EMA") {
        values = computeEMA(closes, ov.period);
      } else {
        return; // RSI, MACD etc. need a separate pane (can add later)
      }

      const lineData = values
        .map((v, i) => (isNaN(v) ? null : { time: candles[i].time, value: v }))
        .filter(Boolean);

      const series = chartRef.current.addSeries(LineSeries, {
        color: ov.color || "#2d5af7",
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(lineData);
      overlaySeriesRef.current.push(series);
    });
  }, [overlays, candles]);

  // Trade markers
  useEffect(() => {
    if (!candleSeriesRef.current || !trades.length) return;

    const markers = [];
    trades.forEach((t) => {
      markers.push({
        time: t.entryTime,
        position: t.side === "long" ? "belowBar" : "aboveBar",
        color: t.side === "long" ? "#26a69a" : "#ef5350",
        shape: t.side === "long" ? "arrowUp" : "arrowDown",
        text: `${t.side.toUpperCase()} @ ${t.entryPrice.toFixed(2)}`,
      });
      markers.push({
        time: t.exitTime,
        position: "aboveBar",
        color: t.pnl >= 0 ? "#26a69a" : "#ef5350",
        shape: "circle",
        text: `CLOSE ${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}`,
      });
    });

    // Sort markers by time (required by lightweight-charts)
    markers.sort((a, b) => a.time - b.time);
    candleSeriesRef.current.setMarkers(markers);
  }, [trades]);

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 400, position: "relative" }}>
      {loading && (
        <div style={{ position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)", color: "#6a6a7a" }}>
          Loading...
        </div>
      )}
    </div>
  );
}

// ─── Frontend-side indicator computation for chart overlays ──
function computeSMA(closes, period) {
  const r = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += closes[j];
    r[i] = s / period;
  }
  return r;
}

function computeEMA(closes, period) {
  const r = new Array(closes.length).fill(NaN);
  const k = 2 / (period + 1);
  let s = 0;
  for (let i = 0; i < period; i++) s += closes[i];
  r[period - 1] = s / period;
  for (let i = period; i < closes.length; i++) r[i] = closes[i] * k + r[i - 1] * (1 - k);
  return r;
}