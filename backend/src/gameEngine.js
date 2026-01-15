import { prisma } from "./db.js";
import { pushCrash, getHistory } from "./historyStore.js";
import { crashMultiplierFromSeeds, newServerSeed, sha256Hex } from "./provablyFair.js";
import { activateBetsForRound, cashoutBet, settleLosses } from "./services/bettingService.js";

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
      startsAt: current.startsAt
    });
  }

  function broadcastTick(multiplier, elapsedMs) {
    io.of("/crash").emit("flight:tick", {
      roundId: current.roundId,
      multiplier,
      elapsedMs
    });
  }

  function broadcastCrash(crashMultiplier) {
    io.of("/crash").emit("round:crash", {
      roundId: current.roundId,
      crashMultiplier,
      serverSeed: current.serverSeed,
      endedAt: nowMs()
    });
  }

  function multiplierAtElapsed(elapsedMs) {
    const t = elapsedMs / 1000;
    const k = 0.08;
    const m = Math.exp(k * t);
    return Math.floor(m * 100) / 100;
  }

  async function createNextRound() {
    clearTimers();

    const last = await prisma.round.findFirst({ orderBy: { createdAt: "desc" } });
    const nextNonce = BigInt(last ? (BigInt(last.nonce) + 1n) : 1n);

    const serverSeed = newServerSeed();
    const serverSeedHash = sha256Hex(serverSeed);

    const clientSeed = "global-client-seed";

    const crash = crashMultiplierFromSeeds({
      serverSeed,
      clientSeed,
      nonce: nextNonce.toString(),
      houseEdge: config.houseEdge
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
        bettingEndAt
      }
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
      lastMultiplier: 1.0
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
        flightStartAt: new Date(current.flightStartMs)
      }
    });

    // IMPORTANT: lock in bets
    await activateBetsForRound(current.roundId);

    broadcastRoundState();

    tickTimer = setInterval(async () => {
      if (!current || current.phase !== "FLIGHT") return;

      const elapsed = nowMs() - current.flightStartMs;
      const m = multiplierAtElapsed(elapsed);
      current.lastMultiplier = m;

      broadcastTick(m, elapsed);

      // auto cashout: find ACTIVE bets with autoCashout <= m
      // (simple approach: query DB each tick; we can optimize later)
      const autoBets = await prisma.bet.findMany({
        where: {
          roundId: current.roundId,
          status: "ACTIVE",
          autoCashout: { not: null, lte: m }
        }
      });

      for (const bet of autoBets) {
        try {
          await cashoutBet({ userId: bet.userId, roundId: bet.roundId, slotIndex: bet.slotIndex, multiplier: m });
          // optionally notify user
          io.of("/crash").to(`user:${bet.userId}`).emit("bets:changed", { roundId: bet.roundId });
        } catch {
          // ignore if already cashed out by race condition
        }
      }

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
        serverSeed: current.serverSeed
      }
    });

    // settle remaining active bets as LOST
    await settleLosses(current.roundId);

    broadcastCrash(current.crashMultiplier);

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
      lastMultiplier: current.lastMultiplier
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
    getPhase
  };
}
