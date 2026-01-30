import crypto from "crypto";

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

/**
 * Crash multiplier from serverSeed + clientSeed + nonce
 * - Uses first 52 bits of HMAC output
 * - Applies house edge
 * - Returns number rounded to 2 decimals, minimum 1.00
 */
export function multiplierFromSeeds({ serverSeed, clientSeed, nonce, houseEdge = 0.03 }) {
  const h = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}`);
  const r = parseInt(h.slice(0, 13), 16); // 52 bits
  const max = 2 ** 52;

  const u = r / max; // [0,1)
  const edge = Math.max(0, Math.min(0.2, houseEdge));
  const m = (1 - edge) / (1 - u);

  const rounded = Math.max(1.0, Math.floor(m * 100) / 100);
  return rounded;
}

export function newServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}
