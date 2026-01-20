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

    // Decimal -> number (or string if you prefer)
    autoCashout: bet.autoCashout == null ? null : Number(bet.autoCashout),
    cashoutMultiplier: bet.cashoutMultiplier == null ? null : Number(bet.cashoutMultiplier),

    placedAt: bet.placedAt,
  };
}

export function toBetsDTO(bets) {
  return (bets || []).map(toBetDTO);
}
