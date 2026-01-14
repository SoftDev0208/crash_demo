import express from "express";
import { prisma } from "../db.js";

export function leaderboardRoutes() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const period = (req.query.period || "daily").toString();
    const now = new Date();

    let start;
    if (period === "weekly") {
      start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    } else if (period === "allTime") {
      start = new Date(0);
    } else {
      // daily
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Profit proxy: sum of ledger deltas since start (BET_PLACE negative, CASHOUT positive, etc.)
    const rows = await prisma.ledgerEntry.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: start } },
      _sum: { delta: true },
      orderBy: { _sum: { delta: "desc" } },
      take: 20
    });

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map(r => r.userId) } },
      select: { id: true, username: true }
    });

    const map = new Map(users.map(u => [u.id, u.username]));
    const out = rows.map((r, i) => ({
      rank: i + 1,
      user: map.get(r.userId) || "Unknown",
      profit: Number(r._sum.delta || 0n)
    }));

    res.json({ period, rows: out });
  });

  return router;
}
