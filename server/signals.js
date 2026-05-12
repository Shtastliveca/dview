import dotenv from "dotenv";
dotenv.config();

const BOT_URL = process.env.BOT_WEBHOOK_URL;
const BOT_SECRET = process.env.BOT_SECRET || "";

/**
 * Forwards a JSON signal to your trading bot.
 * @param {object} signal - { action, symbol, side, size, price, ... }
 */
export async function sendSignal(signal) {
  if (!BOT_URL) {
    throw new Error("BOT_WEBHOOK_URL not set in .env");
  }

  const payload = {
    ...signal,
    timestamp: Date.now(),
    source: "trading-platform",
  };

  const resp = await fetch(BOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(BOT_SECRET && { Authorization: `Bearer ${BOT_SECRET}` }),
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`Bot responded with ${resp.status}: ${await resp.text()}`);
  }

  return { sent: true, payload };
}