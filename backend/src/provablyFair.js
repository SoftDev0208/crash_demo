import crypto from "crypto";

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

/**
 * Deterministic crash multiplier:
 * - Uses 52 bits of randomness from HMAC
 * - Applies house edge
 * - Returns number rounded to 2 decimals, minimum 1.00
 */
export function crashMultiplierFromSeeds({ serverSeed, clientSeed, nonce, houseEdge = 0.01 }) {
  const h = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}`);
  // take first 13 hex chars = 52 bits
  const r = parseInt(h.slice(0, 13), 16); // 0..2^52-1
  const max = 2 ** 52;

  // Map to multiplier (simple, smooth). Keep it >= 1.00.
  // NOTE: This is an MVP mapping; you can swap formula later if desired.
  const u = r / max; // [0,1)
  const edge = Math.max(0, Math.min(0.2, houseEdge));
  const m = (1 - edge) / (1 - u); // >= 1
  const rounded = Math.max(1.0, Math.floor(m * 100) / 100);
  return rounded;
}
