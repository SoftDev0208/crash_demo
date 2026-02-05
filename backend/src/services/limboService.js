import crypto from "crypto";
import { prisma } from "../db.js";

/**
 * Limbo (BC-like):
 * - player chooses targetMultiplier (e.g. 2.00x)
 * - server "rolls" a multiplier (rolledMultiplier)
 * - win if rolledMultiplier >= targetMultiplier
 *
 * payout = targetMultiplier
 * profit = win ? stake*(payout-1) : -stake
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round2(n) {
  return Math.floor(n * 100) / 100;
}

// Generates a rolled multiplier (>=1.00) using uniform randomness.
// If you want provably-fair later, we can swap this with seed-based HMAC.
function rollMultiplier({ houseEdge }) {
  // u in [0,1)
  const u = crypto.randomInt(0, 2 ** 26) / (2 ** 26); // stable-ish uniform
  const edge = clamp(Number(houseEdge || 0), 0, 0.2);

  // Same shape as crash: (1-edge)/(1-u)
  const m = (1 - edge) / (1 - u);
  return Math.max(1.0, round2(m));
}

export async function placeLimboBet({ userId, amount, targetMultiplier, houseEdge = 0.01 }) {
  const stake = BigInt(Math.floor(Number(amount || 0)));
  if (stake <= 0n) throw new Error("INVALID_AMOUNT");

  const target = Number(targetMultiplier);
  if (!Number.isFinite(target) || target > 100000) {
    throw new Error("INVALID_TARGET_MULTIPLIER");
  }

  const rolled = rollMultiplier({ houseEdge });
  const win = rolled >= target;

  // profit:
  // win => stake*(target-1)
  // lose => -stake
  const profit = win
    ? BigInt(Math.floor(Number(stake) * (target - 1)))
    : -stake;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("USER_NOT_FOUND");

    const bal = BigInt(user.pointsBalance);
    if (bal < stake) throw new Error("INSUFFICIENT_FUNDS");

    // subtract stake
    const afterStake = bal - stake;

    await tx.user.update({
      where: { id: userId },
      data: { pointsBalance: afterStake },
    });

    await tx.ledgerEntry.create({
      data: {
        userId,
        roundId: null,
        type: "BET_PLACE",
        delta: -stake,
        balanceAfter: afterStake,
      },
    });

    // apply win payout
    let finalBal = afterStake;

    if (win) {
      const payoutTotal = stake + profit; // stake + (stake*(target-1)) = stake*target
      finalBal = afterStake + payoutTotal;

      await tx.user.update({
        where: { id: userId },
        data: { pointsBalance: finalBal },
      });

      await tx.ledgerEntry.create({
        data: {
          userId,
          roundId: null,
          type: "CASHOUT",
          delta: payoutTotal,
          balanceAfter: finalBal,
        },
      });
    } else {
      await tx.ledgerEntry.create({
        data: {
          userId,
          roundId: null,
          type: "LOSS",
          delta: 0n,
          balanceAfter: finalBal,
        },
      });
    }

    const bet = await tx.limboBet.create({
      data: {
        userId,
        amount: stake,
        targetMultiplier: target,
        rolledMultiplier: rolled,
        win,
        profit,
      },
    });

    return { bet, pointsBalance: finalBal };
  });

  return result;
}

export async function getLimboHistory({ userId, take = 50 }) {
  const rows = await prisma.limboBet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows;
}
