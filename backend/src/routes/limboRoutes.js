import express from "express";
import { requireAuth } from "../middleware/httpAuth.js";
import { placeLimboBet, getLimboHistory } from "../services/limboService.js";
import { toLimboBetsDTO, toLimboBetDTO } from "../utils/serialize.js";

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
      houseEdge: Number(process.env.HOUSE_EDGE || "0.03"),
    });

    res.json({
      ok: true,
      bet: toLimboBetDTO(bet),
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
  const userId = req.user.userId;

  const rows = await getLimboHistory({userId});

  console.log(rows);

  // Decimal -> number
  const items = rows.map(r => Number(r.rolledMultiplier));
  res.json({ items });
});