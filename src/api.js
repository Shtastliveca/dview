const BASE = "";  // same origin; Vite proxies in dev

export async function getSymbols() {
  const r = await fetch(`${BASE}/api/symbols`);
  return r.json();
}

export async function getCandles(symbol, interval, limit = 500) {
  const r = await fetch(
    `${BASE}/api/candles?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  return r.json();
}

export async function runBacktest(payload) {
  const r = await fetch(`${BASE}/api/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

export async function sendSignal(signal) {
  const r = await fetch(`${BASE}/api/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signal),
  });
  return r.json();
}