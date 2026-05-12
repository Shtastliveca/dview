const HL_INFO_URL = "https://api.hyperliquid.xyz/info";

// Map user-friendly intervals to Hyperliquid API format
const INTERVAL_MAP = {
  "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m",
  "30m": "30m", "1h": "1h", "2h": "2h", "4h": "4h",
  "6h": "6h", "12h": "12h", "1d": "1d", "3d": "3d",
  "1w": "1w", "1M": "1M",
};

export async function fetchSymbols() {
  const resp = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  });
  const data = await resp.json();
  // Return array of { name, szDecimals } objects
  return data.universe.map((u) => ({
    name: u.name,
    szDecimals: u.szDecimals,
  }));
}

export async function fetchCandles(symbol, interval, limit = 500, explicitStartMs = null) {
  const hlInterval = INTERVAL_MAP[interval] || "1h";

  const intervalMs = parseIntervalMs(hlInterval);
  const endTime = explicitStartMs
    ? explicitStartMs + intervalMs * limit  // drill-down: fetch from a specific start
    : Date.now();
  const startTime = explicitStartMs || (endTime - intervalMs * limit);

  const resp = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin: symbol,
        interval: hlInterval,
        startTime,
        endTime,
      },
    }),
  });

  const raw = await resp.json();

  // Normalize to standard OHLCV format
  return raw.map((c) => ({
    time: Math.floor(c.t / 1000), // lightweight-charts wants seconds
    open: parseFloat(c.o),
    high: parseFloat(c.h),
    low: parseFloat(c.l),
    close: parseFloat(c.c),
    volume: parseFloat(c.v),
  }));
}

function parseIntervalMs(interval) {
  const units = { m: 60000, h: 3600000, d: 86400000, w: 604800000, M: 2592000000 };
  const match = interval.match(/^(\d+)([mhdwM])$/);
  if (!match) return 3600000;
  return parseInt(match[1]) * units[match[2]];
}