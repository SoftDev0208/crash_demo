import { Router } from "express";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signJwt } from "../auth/jwt.js";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/httpAuth.js";

export const authRoutes = Router();

function toUserDTO(user) {
  return {
    id: user.id,
    username: user.username,
    referralCode: user.referralCode,
    // BigInt -> string for JSON
    pointsBalance: user.pointsBalance?.toString?.() ?? String(user.pointsBalance),
    createdAt: user.createdAt,
  };
}

authRoutes.post("/register", async (req, res) => {
  const { username, password, ref } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username/password required" });

  const passwordHash = await hashPassword(password);

  // optional referral
  let referredByUserId = null;
  if (ref) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: String(ref) } });
    if (referrer) referredByUserId = referrer.id;
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        referralCode: nanoid(8),
        referredByUserId,
      },
    });

    const token = signJwt({ userId: user.id });
    return res.json({ token, user: toUserDTO(user) });
  } catch {
    return res.status(400).json({ error: "Username already exists or invalid data" });
  }
});

authRoutes.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  console.log(username, password);
  if (!username || !password) return res.status(400).json({ error: "username/password required" });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signJwt({ userId: user.id });
  return res.json({ token, user: toUserDTO(user) });
});

authRoutes.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ user: toUserDTO(user) });
});
