import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { fetchCandles, fetchMaxCandles, fetchSymbols, HL_WS_URL, INTERVAL_MAP } from "./hyperliquid.js";
import { runBacktest } from "./backtest-engine.js";
import { sendSignal } from "./signals.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "../dist")));

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// ─── Password auth ───────────────────────────────────────
app.post("/api/auth", (req, res) => {
  if (!APP_PASSWORD) return res.json({ ok: true }); // no password set = open
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Wrong password" });
  }
});

// Check if password is required (no password sent, just asking)
app.get("/api/auth/check", (_, res) => {
  res.json({ required: !!APP_PASSWORD });
});

// ─── Data endpoints ──────────────────────────────────────
app.get("/api/symbols", async (_, res) => {
  try {
    const symbols = await fetchSymbols();
    res.json(symbols);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/candles", async (req, res) => {
  try {
    const { symbol = "BTC", interval = "1h", limit = 500 } = req.query;
    const candles = await fetchCandles(symbol, interval, Number(limit));
    res.json(candles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Backtest — uses fetchMaxCandles for maximum history
app.post("/api/backtest", async (req, res) => {
  try {
    const { symbol, interval, limit, strategyCode, params } = req.body;
    const candles = await fetchMaxCandles(symbol, interval, Number(limit || 10000));
    const results = await runBacktest(candles, strategyCode, params, symbol, interval);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/signal", async (req, res) => {
  try {
    const result = await sendSignal(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Catch-all: serve React app
app.get("/{*splat}", (_, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

// ─── HTTP + WebSocket server ─────────────────────────────
const server = createServer(app);

// WebSocket proxy: browser connects here, we forward to Hyperliquid
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (clientWs) => {
  let hlWs = null;

  clientWs.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Client sends { symbol, interval } to subscribe
      if (data.type === "subscribe") {
        // Close previous HL connection if switching
        if (hlWs) hlWs.close();

        hlWs = new WebSocket(HL_WS_URL);

        hlWs.on("open", () => {
          hlWs.send(JSON.stringify({
            method: "subscribe",
            subscription: {
              type: "candle",
              coin: data.symbol,
              interval: INTERVAL_MAP[data.interval] || "1h",
            },
          }));
        });

        hlWs.on("message", (hlMsg) => {
          try {
            const parsed = JSON.parse(hlMsg);
            // Forward candle updates to browser
            if (parsed.channel === "candle" && parsed.data) {
              const c = parsed.data;
              clientWs.send(JSON.stringify({
                type: "candle",
                candle: {
                  time: Math.floor(c.t / 1000),
                  open: parseFloat(c.o),
                  high: parseFloat(c.h),
                  low: parseFloat(c.l),
                  close: parseFloat(c.c),
                  volume: parseFloat(c.v),
                },
              }));
            }
          } catch {}
        });

        hlWs.on("close", () => { hlWs = null; });
        hlWs.on("error", () => { hlWs = null; });
      }
    } catch {}
  });

  clientWs.on("close", () => {
    if (hlWs) hlWs.close();
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));