import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./db.js";
import { createGameEngine } from "./gameEngine.js";
import { registerCrashNamespace } from "./socket/crashNamespace.js";

import { authRoutes } from "./routes/auth.js";
import { bonusRoutes } from "./routes/bonuses.js";
import { referralRoutes } from "./routes/referrals.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const config = {
  houseEdge: Number(process.env.HOUSE_EDGE || "0.01"),
  bettingMs: Number(process.env.BETTING_MS || "6000"),
  cooldownMs: Number(process.env.COOLDOWN_MS || "2000"),
  tickMs: Number(process.env.TICK_MS || "50")
};

const jwtSecret = process.env.JWT_SECRET || "dev-secret";

async function authUserFromReq(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  try {
    const { uid } = jwt.verify(token, jwtSecret);
    return prisma.user.findUnique({ where: { id: uid } });
  } catch {
    return null;
  }
}

async function authUserFromSocket(socket) {
  const token = socket.handshake.auth?.token;
  if (!token) return null;
  try {
    const { uid } = jwt.verify(token, jwtSecret);
    return prisma.user.findUnique({ where: { id: uid } });
  } catch {
    return null;
  }
}

// attach req.user
app.use(async (req, _res, next) => {
  req.user = await authUserFromReq(req);
  next();
});

app.use("/api/auth", authRoutes({ jwtSecret }));
app.use("/api/bonuses", bonusRoutes());
app.use("/api/referrals", referralRoutes());
app.use("/api/leaderboard", leaderboardRoutes());

app.get("/health", (_req, res) => res.json({ ok: true }));

const engine = createGameEngine({ io, config });

registerCrashNamespace({ io, engine, authUserFromSocket });

const port = Number(process.env.PORT || "4000");
server.listen(port, async () => {
  console.log(`Backend on http://localhost:${port}`);
  await engine.init();
});
