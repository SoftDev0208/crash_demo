import express from "express";
import { requireAuth } from "../middleware/httpAuth.js";
import { placeLimboBet, getLimboHistory } from "../services/limboService.js";
import { toBetsDTO, toBetDTO } from "../utils/serialize.js";

export const limboRoutes = express.Router();

/**
 * POST /api/limbo/bet
 * body: { amount: number, targetMultiplier: number }
 */
limboRoutes.post("/bet", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { amount, targetMultiplier } = req.body || {};
    const { bet, pointsBalance } = await placeLimboBet({
      userId,
      amount,
      targetMultiplier,
      houseEdge: Number(process.env.HOUSE_EDGE || "0.01"),
    });

    res.json({
      ok: true,
      bet: toBetDTO(bet),
      pointsBalance: pointsBalance.toString(),
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

/**
 * GET /api/limbo/history?take=50
 */
limboRoutes.get("/history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const take = Math.min(200, Math.max(1, Number(req.query.take || 50)));

    const rows = await getLimboHistory({ userId, take });
    res.json({ ok: true, items: toBetsDTO(rows) });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});
