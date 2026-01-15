import { prisma } from "../db.js";

// helper: create ledger + update balance atomically
async function applyLedgerTx(tx, { userId, roundId, type, delta }) {
  // lock user row by updating with same value pattern (Prisma doesn't expose FOR UPDATE easily)
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const nextBal = BigInt(user.pointsBalance) + BigInt(delta);

  if (nextBal < 0n) throw new Error("INSUFFICIENT_FUNDS");

  await tx.user.update({
    where: { id: userId },
    data: { pointsBalance: nextBal }
  });

  await tx.ledgerEntry.create({
    data: {
      userId,
      roundId,
      type,
      delta: BigInt(delta),
      balanceAfter: nextBal
    }
  });

  return nextBal;
}

export async function placeBet({ userId, roundId, slotIndex, amount, autoCashout }) {
  if (slotIndex !== 0 && slotIndex !== 1) throw new Error("INVALID_SLOT");
  const amt = BigInt(amount);
  if (amt <= 0n) throw new Error("INVALID_AMOUNT");
  const ac = autoCashout === null || autoCashout === undefined ? null : Number(autoCashout);

  return prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({ where: { id: roundId } });
    if (!round) throw new Error("ROUND_NOT_FOUND");
    if (round.phase !== "BETTING") throw new Error("NOT_BETTING");

    // one bet per slot per round
    const existing = await tx.bet.findFirst({ where: { roundId, userId, slotIndex } });
    if (existing && existing.status !== "CANCELED") throw new Error("SLOT_ALREADY_USED");

    // debit points now
    await applyLedgerTx(tx, { userId, roundId, type: "BET_PLACE", delta: -amt });

    // upsert bet
    const bet = await tx.bet.upsert({
      where: { roundId_userId_slotIndex: { roundId, userId, slotIndex } },
      create: {
        roundId,
        userId,
        slotIndex,
        amount: amt,
        autoCashout: ac,
        status: "PLACED"
      },
      update: {
        amount: amt,
        autoCashout: ac,
        status: "PLACED",
        payout: 0n,
        cashoutMultiplier: null
      }
    });

    return bet;
  });
}

export async function cancelBet({ userId, roundId, slotIndex }) {
  return prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({ where: { id: roundId } });
    if (!round) throw new Error("ROUND_NOT_FOUND");
    if (round.phase !== "BETTING") throw new Error("NOT_BETTING");

    const bet = await tx.bet.findFirst({ where: { roundId, userId, slotIndex } });
    if (!bet) throw new Error("BET_NOT_FOUND");
    if (bet.status !== "PLACED") throw new Error("CANNOT_CANCEL");

    // refund
    await applyLedgerTx(tx, { userId, roundId, type: "BET_CANCEL", delta: BigInt(bet.amount) });

    const updated = await tx.bet.update({
      where: { id: bet.id },
      data: { status: "CANCELED" }
    });

    return updated;
  });
}

export async function activateBetsForRound(roundId) {
  // called once when betting closes
  await prisma.bet.updateMany({
    where: { roundId, status: "PLACED" },
    data: { status: "ACTIVE" }
  });
}

export async function cashoutBet({ userId, roundId, slotIndex, multiplier }) {
  const m = Number(multiplier);
  if (!Number.isFinite(m) || m < 1) throw new Error("BAD_MULTIPLIER");

  return prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({ where: { id: roundId } });
    if (!round) throw new Error("ROUND_NOT_FOUND");
    if (round.phase !== "FLIGHT") throw new Error("NOT_FLIGHT");

    const bet = await tx.bet.findFirst({ where: { roundId, userId, slotIndex } });
    if (!bet) throw new Error("BET_NOT_FOUND");
    if (bet.status !== "ACTIVE") throw new Error("CANNOT_CASHOUT");

    const payout = BigInt(Math.floor(Number(bet.amount) * m));

    // credit payout
    await applyLedgerTx(tx, { userId, roundId, type: "CASHOUT", delta: payout });

    const updated = await tx.bet.update({
      where: { id: bet.id },
      data: {
        status: "CASHED_OUT",
        payout,
        cashoutMultiplier: m
      }
    });

    return updated;
  });
}

export async function settleLosses(roundId) {
  // Mark remaining ACTIVE bets as LOST (amount already debited at place time)
  // Add LOSS ledger entry with delta 0 for audit
  const activeBets = await prisma.bet.findMany({ where: { roundId, status: "ACTIVE" } });
  if (activeBets.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const bet of activeBets) {
      await tx.bet.update({ where: { id: bet.id }, data: { status: "LOST" } });
      await tx.ledgerEntry.create({
        data: {
          userId: bet.userId,
          roundId,
          type: "LOSS",
          delta: 0n,
          balanceAfter: (await tx.user.findUnique({ where: { id: bet.userId } })).pointsBalance
        }
      });
    }
  });
}

export async function getUserBetsForRound(userId, roundId) {
  return prisma.bet.findMany({
    where: { userId, roundId },
    orderBy: { slotIndex: "asc" }
  });
}
