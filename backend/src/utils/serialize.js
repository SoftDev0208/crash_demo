export function bigIntToString(v) {
  return typeof v === "bigint" ? v.toString() : v;
}

export function toBetDTO(bet) {
  if (!bet) return null;
  return {
    id: bet.id,
    roundId: bet.roundId,
    userId: bet.userId,
    slotIndex: bet.slotIndex,
    status: bet.status,

    // BigInt -> string
    amount: bigIntToString(bet.amount),
    payout: bigIntToString(bet.payout),

    // Decimal -> number
    autoCashout: bet.autoCashout == null ? null : Number(bet.autoCashout),
    cashoutMultiplier: bet.cashoutMultiplier == null ? null : Number(bet.cashoutMultiplier),

    placedAt: bet.placedAt,
  };
}

export function toBetsDTO(bets) {
  return (bets || []).map(toBetDTO);
}

/** ✅ Limbo DTO */
export function toLimboBetDTO(bet) {
  if (!bet) return null;

  return {
    id: bet.id,
    userId: bet.userId,

    // BigInt -> string
    amount: bigIntToString(bet.amount),
    profit: bigIntToString(bet.profit),

    // Decimal -> number
    targetMultiplier: bet.targetMultiplier == null ? null : Number(bet.targetMultiplier),
    rolledMultiplier: bet.rolledMultiplier == null ? null : Number(bet.rolledMultiplier),

    win: !!bet.win,
    createdAt: bet.createdAt,
  };
}

// (optional) list serializer
export function toLimboBetsDTO(bets) {
  return (bets || []).map(toLimboBetDTO);
}
