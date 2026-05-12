import React, { useRef, useEffect } from "react";
import { createChart, CandlestickSeries, LineSeries, createSeriesMarkers } from "lightweight-charts";

export default function Chart({ candles, overlays, trades, loading }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const overlaySeriesRef = useRef([]);
  const markersRef = useRef(null); // v5 markers primitive
  const prevCandlesRef = useRef([]);

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

  // Update candle data — smart: only fitContent on full reloads, not live ticks
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;

    const prev = prevCandlesRef.current;
    const isLiveUpdate =
      prev.length > 0 &&
      (candles.length === prev.length || candles.length === prev.length + 1);

    if (isLiveUpdate) {
      // Live tick: update just the last candle, don't reset the view
      candleSeriesRef.current.update(candles[candles.length - 1]);
    } else {
      // Full reload (new symbol, new interval, initial load)
      candleSeriesRef.current.setData(candles);
      chartRef.current.timeScale().fitContent();
    }

    prevCandlesRef.current = candles;
  }, [candles]);

  // Update indicator overlays
  useEffect(() => {
    if (!chartRef.current || !candles.length) return;

    overlaySeriesRef.current.forEach((s) => {
      try { chartRef.current.removeSeries(s); } catch {}
    });
    overlaySeriesRef.current = [];

    const closes = candles.map((c) => c.close);

    overlays.forEach((ov) => {
      let values;
      if (ov.type === "SMA") {
        values = computeSMA(closes, ov.period);
      } else if (ov.type === "EMA") {
        values = computeEMA(closes, ov.period);
      } else {
        return;
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

  // Trade markers (v5 API: createSeriesMarkers)
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Build marker array
    const markers = [];
    (trades || []).forEach((t) => {
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
    markers.sort((a, b) => a.time - b.time);

    try {
      if (markersRef.current) {
        // Update existing markers primitive
        markersRef.current.setMarkers(markers);
      } else if (markers.length > 0) {
        // Create new markers primitive (v5 API)
        markersRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
      }
    } catch (err) {
      console.warn("Markers error:", err);
    }
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

// ─── Frontend-side indicator computation ─────────────────
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