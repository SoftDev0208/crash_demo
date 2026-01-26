import express from "express";
import jwt from "jsonwebtoken";
import { placeLimboBet } from "../services/limboService.js";

export const limboRoutes = express.Router();

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "NO_TOKEN" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "BAD_TOKEN" });
  }
}

// BigInt-safe output
function toLimboDTO(x) {
  return {
    id: x.id,
    userId: x.userId,
    amount: x.amount?.toString?.() ?? String(x.amount),
    payout: Number(x.payout),
    chance: Number(x.chance),
    roll: Number(x.roll),
    win: !!x.win,
    profit: x.profit?.toString?.() ?? String(x.profit),
    createdAt: x.createdAt,
  };
}

limboRoutes.post("/bet", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const amount = Number(req.body?.amount);
    const payout = Number(req.body?.payout);

    const houseEdge = Number(process.env.HOUSE_EDGE || "0.01");

    const { bet, pointsBalance } = await placeLimboBet({ userId, amount, payout, houseEdge });

    res.json({
      ok: true,
      bet: toLimboDTO(bet),
      pointsBalance: pointsBalance.toString(),
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});
