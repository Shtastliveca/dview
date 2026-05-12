const HL_INFO_URL = "https://api.hyperliquid.xyz/info";
const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";

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
  return data.universe.map((u) => ({
    name: u.name,
    szDecimals: u.szDecimals,
  }));
}

/**
 * Fetch candles with optional explicit start time (for drill-down).
 * For normal use, calculates start from limit.
 */
export async function fetchCandles(symbol, interval, limit = 500, explicitStartMs = null) {
  const hlInterval = INTERVAL_MAP[interval] || "1h";
  const intervalMs = parseIntervalMs(hlInterval);
  const endTime = explicitStartMs
    ? explicitStartMs + intervalMs * limit
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

  return raw.map((c) => ({
    time: Math.floor(c.t / 1000),
    open: parseFloat(c.o),
    high: parseFloat(c.h),
    low: parseFloat(c.l),
    close: parseFloat(c.c),
    volume: parseFloat(c.v),
  }));
}

/**
 * Fetch maximum available history by paginating backwards.
 * Hyperliquid returns up to ~5000 candles per request.
 * We keep fetching older batches until we get no more data.
 */
export async function fetchMaxCandles(symbol, interval, targetLimit = 10000) {
  const hlInterval = INTERVAL_MAP[interval] || "1h";
  const intervalMs = parseIntervalMs(hlInterval);
  const batchSize = 5000;

  let allCandles = [];
  let endTime = Date.now();
  let retries = 0;
  const maxRetries = Math.ceil(targetLimit / batchSize) + 2;

  while (allCandles.length < targetLimit && retries < maxRetries) {
    const startTime = endTime - intervalMs * batchSize;

    const resp = await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: { coin: symbol, interval: hlInterval, startTime, endTime },
      }),
    });

    const raw = await resp.json();
    if (!raw || raw.length === 0) break; // no more data available

    const batch = raw.map((c) => ({
      time: Math.floor(c.t / 1000),
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
      volume: parseFloat(c.v),
    }));

    allCandles = [...batch, ...allCandles]; // prepend older candles
    endTime = batch[0].time * 1000 - 1;     // move window earlier
    retries++;

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  // Deduplicate by time (overlapping edges)
  const seen = new Set();
  allCandles = allCandles.filter((c) => {
    if (seen.has(c.time)) return false;
    seen.add(c.time);
    return true;
  });

  // Sort chronologically and trim to target
  allCandles.sort((a, b) => a.time - b.time);
  if (allCandles.length > targetLimit) {
    allCandles = allCandles.slice(allCandles.length - targetLimit);
  }

  return allCandles;
}

export { HL_WS_URL, INTERVAL_MAP };

function parseIntervalMs(interval) {
  const units = { m: 60000, h: 3600000, d: 86400000, w: 604800000, M: 2592000000 };
  const match = interval.match(/^(\d+)([mhdwM])$/);
  if (!match) return 3600000;
  return parseInt(match[1]) * units[match[2]];
}