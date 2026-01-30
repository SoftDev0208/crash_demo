import { prisma } from "./db.js";
import { pushCrash, getHistory } from "./historyStore.js";
import { multiplierFromSeeds, newServerSeed, sha256Hex } from "./provablyFair.js";
import {
  activateBetsForRound,
  cashoutBet,
  settleLosses,
  getUserBetsForRound,
} from "./services/bettingService.js";
import { getUserBalance } from "./services/balanceService.js";
import { toBetsDTO } from "./utils/serialize.js";

export function createGameEngine({ io, config }) {
  let current = null;
  let tickTimer = null;
  let phaseTimer = null;

  function clearTimers() {
    if (tickTimer) clearInterval(tickTimer);
    if (phaseTimer) clearTimeout(phaseTimer);
    tickTimer = null;
    phaseTimer = null;
  }

  function nowMs() {
    return Date.now();
  }

  function broadcastRoundState() {
    if (!current) return;
    io.of("/crash").emit("round:state", {
      roundId: current.roundId,
      phase: current.phase,
      serverSeedHash: current.serverSeedHash,
      clientSeed: current.clientSeed,
      nonce: Number(current.nonce),
      bettingEndsAt: current.bettingEndsAt,
      startsAt: current.startsAt,
    });
  }

  function broadcastTick(multiplier, elapsedMs) {
    if (!current) return;
    io.of("/crash").emit("flight:tick", {
      roundId: current.roundId,
      multiplier,
      elapsedMs,
    });
  }

  function broadcastCrash(crashMultiplier) {
    if (!current) return;
    io.of("/crash").emit("round:crash", {
      roundId: current.roundId,
      crashMultiplier,
      serverSeed: current.serverSeed,
      endedAt: nowMs(),
    });
  }

  function multiplierAtElapsed(elapsedMs) {
    const t = elapsedMs / 1000;
    const k = 0.08;
    const m = Math.exp(k * t);
    return Math.floor(m * 100) / 100;
  }

  // ✅ Single source of truth: always push latest bets + balance to user
  async function emitUserState(userId, roundId) {
    const bets = await getUserBetsForRound(userId, roundId);
    io.of("/crash").to(`user:${userId}`).emit("bets:update", {
      roundId,
      userId,
      bets: toBetsDTO(bets),
    });

    const balance = await getUserBalance(userId);
    io.of("/crash").to(`user:${userId}`).emit("balance:update", {
      pointsBalance: balance,
    });
  }

  async function createNextRound() {
    clearTimers();

    const last = await prisma.round.findFirst({ orderBy: { createdAt: "desc" } });
    const nextNonce = BigInt(last ? BigInt(last.nonce) + 1n : 1n);

    const serverSeed = newServerSeed();
    const serverSeedHash = sha256Hex(serverSeed);
    const clientSeed = "global-client-seed";

    const crash = multiplierFromSeeds({
      serverSeed,
      clientSeed,
      nonce: nextNonce.toString(),
      houseEdge: config.houseEdge,
    });

    const t0 = nowMs();
    const bettingStartAt = new Date(t0);
    const bettingEndAt = new Date(t0 + config.bettingMs);

    const round = await prisma.round.create({
      data: {
        nonce: nextNonce,
        serverSeedHash,
        serverSeed: null,
        crashMultiplier: crash,
        phase: "BETTING",
        bettingStartAt,
        bettingEndAt,
      },
    });

    current = {
      roundId: round.id,
      nonce: nextNonce.toString(),
      phase: "BETTING",
      serverSeed,
      serverSeedHash,
      clientSeed,
      crashMultiplier: Number(crash),
      bettingEndsAt: bettingEndAt.getTime(),
      startsAt: bettingEndAt.getTime(),
      flightStartMs: null,
      lastMultiplier: 1.0,
    };

    broadcastRoundState();
    phaseTimer = setTimeout(() => beginFlight(), config.bettingMs);
  }

  async function beginFlight() {
    if (!current) return;

    current.phase = "FLIGHT";
    current.flightStartMs = nowMs();
    current.lastMultiplier = 1.0;

    await prisma.round.update({
      where: { id: current.roundId },
      data: {
        phase: "FLIGHT",
        flightStartAt: new Date(current.flightStartMs),
      },
    });

    // ✅ Lock in bets (PLACED -> ACTIVE)
    await activateBetsForRound(current.roundId);

    // ✅ Immediately push updated bet status to all users who placed bets
    const users = await prisma.bet.findMany({
      where: { roundId: current.roundId },
      select: { userId: true },
      distinct: ["userId"],
    });

    await Promise.all(users.map((u) => emitUserState(u.userId, current.roundId)));

    broadcastRoundState();

    tickTimer = setInterval(async () => {
      if (!current || current.phase !== "FLIGHT") return;

      const elapsed = nowMs() - current.flightStartMs;
      const m = multiplierAtElapsed(elapsed);
      current.lastMultiplier = m;

      broadcastTick(m, elapsed);

      // ✅ AUTO CASHOUT (server authoritative)
      const autoBets = await prisma.bet.findMany({
        where: {
          roundId: current.roundId,
          status: "ACTIVE",
          autoCashout: { not: null, lte: m },
        },
        select: { userId: true, roundId: true, slotIndex: true },
      });

      const touchedUsers = new Set();

      for (const b of autoBets) {
        try {
          await cashoutBet({
            userId: b.userId,
            roundId: b.roundId,
            slotIndex: b.slotIndex,
            multiplier: m,
          });
          touchedUsers.add(b.userId);
        } catch {
          // ignore race
        }
      }

      if (touchedUsers.size > 0) {
        await Promise.all([...touchedUsers].map((uid) => emitUserState(uid, current.roundId)));
      }

      // Crash check
      if (m >= current.crashMultiplier) {
        await crashNow();
      }
    }, config.tickMs);
  }

  async function crashNow() {
    if (!current) return;
    clearTimers();

    current.phase = "CRASH";
    const crashAt = new Date();

    await prisma.round.update({
      where: { id: current.roundId },
      data: {
        phase: "CRASH",
        crashAt,
        serverSeed: current.serverSeed,
      },
    });

    // ✅ settle remaining ACTIVE bets as LOST, returns affected userIds
    const losers = await settleLosses(current.roundId);

    // ✅ Push updated bets + balance to losers (and anyone else affected)
    await Promise.all(losers.map((uid) => emitUserState(uid, current.roundId)));

    broadcastCrash(current.crashMultiplier);

    // History
    pushCrash(current.crashMultiplier);
    io.of("/crash").emit("history:update", { items: getHistory() });

    current.phase = "COOLDOWN";
    broadcastRoundState();

    phaseTimer = setTimeout(() => createNextRound(), config.cooldownMs);
  }

  async function init() {
    await createNextRound();
  }

  async function getPublicState() {
    if (!current) return null;
    return {
      roundId: current.roundId,
      phase: current.phase,
      serverSeedHash: current.serverSeedHash,
      clientSeed: current.clientSeed,
      nonce: Number(current.nonce),
      bettingEndsAt: current.bettingEndsAt,
      startsAt: current.startsAt,
      lastMultiplier: current.lastMultiplier,
    };
  }

  function getCurrentMultiplier() {
    return current?.lastMultiplier ?? 1.0;
  }

  function getCurrentRoundId() {
    return current?.roundId ?? null;
  }

  function getPhase() {
    return current?.phase ?? null;
  }

  return {
    init,
    getPublicState,
    getCurrentMultiplier,
    getCurrentRoundId,
    getPhase,
  };
}
