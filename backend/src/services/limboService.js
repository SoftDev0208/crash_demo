import crypto from "crypto";
import { prisma } from "../db.js";

/**
 * Limbo math:
 * payout = (1 - edge) / (chance/100)
 * chance = ((1 - edge) / payout) * 100
 *
 * roll is [0, 100)
 * win if roll < chance
 */
function randomRollPercent() {
  // 0..9999 -> 0.00..99.99
  const n = crypto.randomInt(0, 10000);
  return n / 100;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export async function placeLimboBet({ userId, amount, payout, houseEdge = 0.01 }) {
  const amt = BigInt(Math.floor(Number(amount || 0)));
  if (amt <= 0n) throw new Error("INVALID_AMOUNT");

  const edge = clamp(Number(houseEdge), 0, 0.2);
  const p = Number(payout);

  if (!Number.isFinite(p) || p < 1.01 || p > 100000) throw new Error("INVALID_PAYOUT");

  const chance = clamp(((1 - edge) / p) * 100, 0.01, 99.99);
  const roll = randomRollPercent();
  const win = roll < chance;

  // Balance changes:
  // - subtract stake
  // - if win, add back stake * payout
  // profit = win ? (stake*payout - stake) : (-stake)
  const winPayout = win ? BigInt(Math.floor(Number(amt) * p)) : 0n;
  const profit = win ? (winPayout - amt) : (-amt);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("USER_NOT_FOUND");

    const bal = BigInt(user.pointsBalance);
    if (bal < amt) throw new Error("INSUFFICIENT_FUNDS");

    // subtract stake first
    const afterStake = bal - amt;

    await tx.user.update({
      where: { id: userId },
      data: { pointsBalance: afterStake },
    });

    // ledger: bet place
    await tx.ledgerEntry.create({
      data: {
        userId,
        roundId: null,
        type: "BET_PLACE",
        delta: -amt,
        balanceAfter: afterStake,
      },
    });

    let finalBal = afterStake;

    if (win) {
      finalBal = afterStake + winPayout;

      await tx.user.update({
        where: { id: userId },
        data: { pointsBalance: finalBal },
      });

      await tx.ledgerEntry.create({
        data: {
          userId,
          roundId: null,
          type: "CASHOUT",
          delta: winPayout,
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

    // Create the Limbo bet record with targetMultiplier and rolledMultiplier
    const bet = await tx.limboBet.create({
      data: {
        userId,
        amount: amt,
        payout: p,
        chance,
        roll,
        win,
        profit,
        targetMultiplier: p,  // The target multiplier user wants to hit
        rolledMultiplier: win ? roll : 0n,  // The multiplier that was actually rolled
      },
    });

    return { bet, pointsBalance: finalBal };
  });

  return result;
}
