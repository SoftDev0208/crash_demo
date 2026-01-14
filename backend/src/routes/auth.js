import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { prisma } from "../db.js";

export function authRoutes({ jwtSecret }) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    const { username, password, ref } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = nanoid(10);

    let referredByUserId = null;
    if (ref) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: ref } });
      if (referrer) referredByUserId = referrer.id;
    }

    const user = await prisma.user.create({
      data: { username, passwordHash, referralCode, referredByUserId }
    });

    const token = jwt.sign({ uid: user.id }, jwtSecret, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, pointsBalance: user.pointsBalance.toString(), referralCode } });
  });

  router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ uid: user.id }, jwtSecret, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, pointsBalance: user.pointsBalance.toString(), referralCode: user.referralCode } });
  });

  router.get("/me", async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    res.json({ id: user.id, username: user.username, pointsBalance: user.pointsBalance.toString(), referralCode: user.referralCode });
  });

  return router;
}
