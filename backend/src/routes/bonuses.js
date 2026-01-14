import express from "express";
import { prisma } from "../db.js";

export function bonusRoutes() {
  const router = express.Router();

  router.get("/status", async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // daily bonus: once per calendar day (server local time)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const claimed = await prisma.bonus.findFirst({
      where: { userId: user.id, type: "DAILY", availableAt: { gte: start, lt: end }, claimedAt: { not: null } }
    });

    res.json({ daily: { available: !claimed, amount: 1000 } });
  });

  router.post("/claim", async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { type } = req.body || {};
    if (type !== "daily") return res.status(400).json({ error: "Unsupported" });

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const amount = 1000n;

    const result = await prisma.$transaction(async (tx) => {
      const already = await tx.bonus.findFirst({
        where: { userId: user.id, type: "DAILY", availableAt: { gte: start, lt: end }, claimedAt: { not: null } }
      });
      if (already) throw new Error("Already claimed");

      const bonus = await tx.bonus.create({
        data: { userId: user.id, type: "DAILY", amount, availableAt: start, claimedAt: now }
      });

      const fresh = await tx.user.findUnique({ where: { id: user.id } });
      const newBalance = fresh.pointsBalance + amount;

      await tx.user.update({ where: { id: user.id }, data: { pointsBalance: newBalance } });
      await tx.ledgerEntry.create({
        data: { userId: user.id, type: "BONUS", delta: amount, balanceAfter: newBalance }
      });

      return { bonus, newBalance };
    });

    res.json({ ok: true, pointsBalance: result.newBalance.toString() });
  });

  return router;
}
