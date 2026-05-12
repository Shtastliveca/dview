import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { fetchCandles, fetchSymbols } from "./hyperliquid.js";
import { runBacktest } from "./backtest-engine.js";
import { sendSignal } from "./signals.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve the built frontend in production
app.use(express.static(path.join(__dirname, "../dist")));

// Health check for Railway
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// Get available trading symbols
app.get("/api/symbols", async (_, res) => {
  try {
    const symbols = await fetchSymbols();
    res.json(symbols);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get candle data
// Usage: /api/candles?symbol=BTC&interval=1h&limit=500
app.get("/api/candles", async (req, res) => {
  try {
    const { symbol = "BTC", interval = "1h", limit = 500 } = req.query;
    const candles = await fetchCandles(symbol, interval, Number(limit));
    res.json(candles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Run a backtest
app.post("/api/backtest", async (req, res) => {
  try {
    const { symbol, interval, limit, strategyCode, params } = req.body;
    const candles = await fetchCandles(symbol, interval, Number(limit || 1000));
    const results = await runBacktest(candles, strategyCode, params, symbol, interval);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Forward a signal to your trading bot
app.post("/api/signal", async (req, res) => {
  try {
    const result = await sendSignal(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Catch-all: serve React app for any non-API route
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));