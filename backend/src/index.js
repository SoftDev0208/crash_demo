import "dotenv/config";
import { getHistory } from "./historyStore.js";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { createGameEngine } from "./gameEngine.js";
import { authRoutes } from "./routes/authRoutes.js";
import { socketAuth } from "./socket/socketAuth.js";
import { placeBet, cancelBet, cashoutBet, getUserBetsForRound } from "./services/bettingService.js";
import { getUserBalance } from "./services/balanceService.js";
import { toBetDTO, toBetsDTO } from "./utils/serialize.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// REST routes
app.use("/api/auth", authRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

const config = {
  houseEdge: Number(process.env.HOUSE_EDGE || "0.01"),
  bettingMs: Number(process.env.BETTING_MS || "6000"),
  cooldownMs: Number(process.env.COOLDOWN_MS || "2000"),
  tickMs: Number(process.env.TICK_MS || "50"),
};

const engine = createGameEngine({ io, config });

// Socket namespace
const nsp = io.of("/crash");

// Require JWT for socket
nsp.use(socketAuth);

nsp.on("connection", async (socket) => {
  const userId = socket.user.userId;

  // Room per user for targeted messages
  socket.join(`user:${userId}`);

  // Send current round state
  const state = await engine.getPublicState();
  if (state) socket.emit("round:state", state);

  // Send user bets for current round (if any)
  const roundId = engine.getCurrentRoundId();
  if (roundId) {
    const bets = await getUserBetsForRound(userId, roundId);
    socket.emit("bets:update", { roundId, userId, bets: toBetsDTO(bets) });
  }

  // History
  socket.emit("history:update", { items: getHistory() });

  // Balance
  const balance = await getUserBalance(userId);
  socket.emit("balance:update", { pointsBalance: balance });

  socket.on("bet:place", async (payload, cb) => {
    try {
      const roundId2 = payload?.roundId || engine.getCurrentRoundId();

      const bet = await placeBet({
        userId,
        roundId: roundId2,
        slotIndex: Number(payload.slotIndex),
        amount: payload.amount,
        autoCashout: payload.autoCashout ?? null,
      });

      const bets = await getUserBetsForRound(userId, roundId2);
      socket.emit("bets:update", { roundId: roundId2, userId, bets: toBetsDTO(bets) });

      const balance2 = await getUserBalance(userId);
      socket.emit("balance:update", { pointsBalance: balance2 });

      // ✅ BigInt safe
      cb?.({ ok: true, bet: toBetDTO(bet) });
    } catch (e) {
      cb?.({ ok: false, error: String(e?.message || e) });
    }
  });

  socket.on("bet:cancel", async (payload, cb) => {
    try {
      const roundId2 = payload?.roundId || engine.getCurrentRoundId();

      const bet = await cancelBet({
        userId,
        roundId: roundId2,
        slotIndex: Number(payload.slotIndex),
      });

      const bets = await getUserBetsForRound(userId, roundId2);
      socket.emit("bets:update", { roundId: roundId2, userId, bets: toBetsDTO(bets) });

      const balance2 = await getUserBalance(userId);
      socket.emit("balance:update", { pointsBalance: balance2 });

      // ✅ BigInt safe
      cb?.({ ok: true, bet: toBetDTO(bet) });
    } catch (e) {
      cb?.({ ok: false, error: String(e?.message || e) });
    }
  });

  socket.on("bet:refresh", async (payload, cb) => {
    try {
      const roundId2 = payload?.roundId || engine.getCurrentRoundId();
      if (!roundId2) return cb?.({ ok: false, error: "NO_ROUND" });

      const bets = await getUserBetsForRound(userId, roundId2);
      socket.emit("bets:update", { roundId: roundId2, userId, bets });

      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: String(e?.message || e) });
    }
  });


  socket.on("bet:cashout", async (payload, cb) => {
    try {
      const roundId2 = payload?.roundId || engine.getCurrentRoundId();
      const m = engine.getCurrentMultiplier();

      const bet = await cashoutBet({
        userId,
        roundId: roundId2,
        slotIndex: Number(payload.slotIndex),
        multiplier: m,
      });

      const bets = await getUserBetsForRound(userId, roundId2);
      socket.emit("bets:update", { roundId: roundId2, userId, bets: toBetsDTO(bets) });

      const balance2 = await getUserBalance(userId);
      socket.emit("balance:update", { pointsBalance: balance2 });

      // ✅ BigInt safe
      cb?.({ ok: true, bet: toBetDTO(bet), multiplier: m });
    } catch (e) {
      cb?.({ ok: false, error: String(e?.message || e) });
    }
  });
});

const port = Number(process.env.PORT || "4000");
server.listen(port, async () => {
  console.log(`Backend running: http://localhost:${port}`);
  await engine.init();
});
