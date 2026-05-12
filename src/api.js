const BASE = "";

export async function checkAuthRequired() {
  const r = await fetch(`${BASE}/api/auth/check`);
  const data = await r.json();
  return data.required;
}

export async function login(password) {
  const r = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Wrong password");
  return data;
}

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