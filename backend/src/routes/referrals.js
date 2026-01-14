import express from "express";
import { prisma } from "../db.js";

export function referralRoutes() {
  const router = express.Router();

  router.get("/me", async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const referred = await prisma.user.count({ where: { referredByUserId: user.id } });
    const paid = await prisma.referralReward.count({ where: { referrerUserId: user.id, status: "PAID" } });

    res.json({ referralCode: user.referralCode, referredCount: referred, paidRewards: paid });
  });

  // Simple reward rule MVP:
  // If a referred user exists and has at least 5 CASHOUT ledger entries, pay referrer once.
  router.post("/check-and-pay", async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const referredUsers = await prisma.user.findMany({ where: { referredByUserId: user.id }, select: { id: true } });
    let paidNow = 0;

    for (const ru of referredUsers) {
      const exists = await prisma.referralReward.findUnique({
        where: { referrerUserId_referredUserId: { referrerUserId: user.id, referredUserId: ru.id } }
      });
      if (exists) continue;

      const cashouts = await prisma.ledgerEntry.count({
        where: { userId: ru.id, type: "CASHOUT" }
      });

      if (cashouts >= 5) {
        const reward = 2000n;
        await prisma.$transaction(async (tx) => {
          await tx.referralReward.create({
            data: { referrerUserId: user.id, referredUserId: ru.id, rewardPoints: reward, status: "PAID" }
          });

          const fresh = await tx.user.findUnique({ where: { id: user.id } });
          const newBalance = fresh.pointsBalance + reward;

          await tx.user.update({ where: { id: user.id }, data: { pointsBalance: newBalance } });
          await tx.ledgerEntry.create({
            data: { userId: user.id, type: "REFERRAL", delta: reward, balanceAfter: newBalance }
          });
        });

        paidNow += 1;
      }
    }

    res.json({ ok: true, paidNow });
  });

  return router;
}
