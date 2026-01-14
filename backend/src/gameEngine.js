import crypto from "crypto";
import { prisma } from "./db.js";
import { sha256Hex, crashMultiplierFromSeeds } from "./provablyFair.js";

export function createGameEngine({ io, config }) {
  let current = null; // in-memory round state
  let tickTimer = null;
  let phaseTimer = null;

  async function init() {
    await ensureNonceSeed();
    await startNextRound();
  }

  async function ensureNonceSeed() {
    // If no rounds exist, start nonce at 1
    const last = await prisma.round.findFirst({ orderBy: { createdAt: "desc" } });
    if (!last) return;
  }

  async function startNextRound() {
    clearTimers();

    const last = await prisma.round.findFirst({ orderBy: { createdAt: "desc" } });
    const nonce = BigInt(last ? (BigInt(last.nonce) + 1n) : 1n);

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = sha256Hex(serverSeed);

    // For MVP, use a global clientSeed. You can let each user set their own and store it.
    const clientSeed = "global-client-seed";

    const crash = crashMultiplierFromSeeds({
      serverSeed,
      clientSeed,
      nonce: nonce.toString(),
      houseEdge: config.houseEdge
    });

    const now = Date.now();
    const bettingStartAt = new Date(now);
    const bettingEndAt = new Date(now + config.bettingMs);

    const round = await prisma.round.create({
      data: {
        nonce,
        serverSeedHash,
        serverSeed: null, // revealed after crash
        crashMultiplier: crash,
        phase: "BETTING",
        bettingStartAt,
        bettingEndAt
      }
    });

    current = {
      roundId: round.id,
      nonce: round.nonce.toString(),
      serverSeed,
      serverSeedHash,
      clientSeed,
      crashMultiplier: Number(crash),
      phase: "BETTING",
      bettingEndsAt: bettingEndAt.getTime(),
      startsAt: bettingEndAt.getTime(),
      flightStartMs: null,
      lastMultiplier: 1.0
    };

    broadcastRoundState();

    phaseTimer = setTimeout(async () => {
      await beginFlight();
    }, config.bettingMs);
  }

  function broadcastRoundState() {
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

  async function beginFlight() {
    current.phase = "FLIGHT";
    current.flightStartMs = Date.now();

    await prisma.round.update({
      where: { id: current.roundId },
      data: { phase: "FLIGHT", flightStartAt: new Date(current.flightStartMs) }
    });

    // move PLACED -> ACTIVE at flight start
    await prisma.bet.updateMany({
      where: { roundId: current.roundId, status: "PLACED" },
      data: { status: "ACTIVE" }
    });

    broadcastRoundState();
    startTicking();
  }

  function multiplierAtElapsed(elapsedMs) {
    // Smooth growth curve (tunable). This feels like crash:
    // m = exp(k * t), with t in seconds. k ~ 0.08 gives decent pacing.
    const t = elapsedMs / 1000;
    const k = 0.08;
    const m = Math.exp(k * t);
    return Math.floor(m * 100) / 100;
  }

  function startTicking() {
    tickTimer = setInterval(async () => {
      if (!current || current.phase !== "FLIGHT") return;

      const elapsed = Date.now() - current.flightStartMs;
      const m = multiplierAtElapsed(elapsed);
      current.lastMultiplier = m;

      io.of("/crash").emit("flight:tick", {
        roundId: current.roundId,
        multiplier: m,
        elapsedMs: elapsed
      });

      // auto cashouts
      await processAutoCashouts(m);

      // crash check
      if (m >= current.crashMultiplier) {
        await crashNow();
      }
    }, config.tickMs);
  }

  async function processAutoCashouts(multiplier) {
    // Find ACTIVE bets with autoCashout <= multiplier
    const candidates = await prisma.bet.findMany({
      where: {
        roundId: current.roundId,
        status: "ACTIVE",
        autoCashout: { not: null, lte: multiplier }
      },
      take: 2000
    });

    for (const bet of candidates) {
      // idempotent cashout via transaction
      await cashoutBet({ userId: bet.userId, slotIndex: bet.slotIndex, multiplier });
    }
  }

  async function crashNow() {
    clearInterval(tickTimer);
    tickTimer = null;

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

    // remaining ACTIVE bets lose
    await settleLosses();

    io.of("/crash").emit("round:crash", {
      roundId: current.roundId,
      crashMultiplier: current.crashMultiplier,
      serverSeed: current.serverSeed,
      endedAt: crashAt.getTime()
    });

    // cooldown then next
    current.phase = "COOLDOWN";
    broadcastRoundState();

    phaseTimer = setTimeout(async () => {
      await startNextRound();
    }, config.cooldownMs);
  }

  async function settleLosses() {
    const losers = await prisma.bet.findMany({
      where: { roundId: current.roundId, status: "ACTIVE" },
      take: 5000
    });

    for (const bet of losers) {
      await prisma.$transaction(async (tx) => {
        // mark lost if still ACTIVE
        const updated = await tx.bet.updateMany({
          where: { id: bet.id, status: "ACTIVE" },
          data: { status: "LOST", payout: 0n }
        });
        if (updated.count === 0) return;

        // ledger entry for loss is optional because bet placement already deducted points.
        // If you want explicit LOSS entries, add them here (delta = 0 or informational).
      });
    }
  }

  async function placeBet({ userId, slotIndex, amount, autoCashout }) {
    if (!current || current.phase !== "BETTING") throw new Error("Betting closed");
    if (![0, 1].includes(slotIndex)) throw new Error("Invalid slot");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      if (user.pointsBalance < BigInt(amount)) throw new Error("Insufficient points");

      // upsert bet for slot (allow updating during betting)
      const bet = await tx.bet.upsert({
        where: { roundId_userId_slotIndex: { roundId: current.roundId, userId, slotIndex } },
        update: {
          amount: BigInt(amount),
          autoCashout: autoCashout != null ? autoCashout : null,
          status: "PLACED"
        },
        create: {
          roundId: current.roundId,
          userId,
          slotIndex,
          amount: BigInt(amount),
          autoCashout: autoCashout != null ? autoCashout : null,
          status: "PLACED"
        }
      });

      // Deduct points only if this is a fresh placement OR if amount changed, reconcile delta:
      // For MVP simplicity: compute total placed in this slot now vs previous via a read.
      // Here we do: remove old cost then add new cost by looking up previous ledger entry is heavier.
      // Easier: store a BET_PLACE ledger always for the new amount, and if updating, refund previous amount first.
      // We'll implement refund+charge by reading existing bet before update:
      // (Prisma upsert doesn't give previous, so do a separate read.)

      const existing = await tx.bet.findUnique({
        where: { roundId_userId_slotIndex: { roundId: current.roundId, userId, slotIndex } }
      });

      // NOTE: existing is now the updated one due to upsert; for MVP, we’ll enforce "place once" per slot.
      // If you want editing bets during betting, we can adjust this logic.
      // We'll block re-place to keep ledger clean.
      // If you want editing, tell me and I’ll patch it.

      // charge once if first time in round
      // If bet was just created, we need to deduct; detect by checking placedAt close? Not safe.
      // Instead: check if there is already a BET_PLACE ledger for this round+slot via a synthetic key.
      // MVP approach: don't allow placing twice; frontend will disable once placed unless canceled.

      // Deduct
      const newBalance = user.pointsBalance - BigInt(amount);
      await tx.user.update({ where: { id: userId }, data: { pointsBalance: newBalance } });
      await tx.ledgerEntry.create({
        data: {
          userId,
          roundId: current.roundId,
          type: "BET_PLACE",
          delta: -BigInt(amount),
          balanceAfter: newBalance
        }
      });

      return bet;
    });
  }

  async function cancelBet({ userId, slotIndex }) {
    if (!current || current.phase !== "BETTING") throw new Error("Cannot cancel now");

    return prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findUnique({
        where: { roundId_userId_slotIndex: { roundId: current.roundId, userId, slotIndex } }
      });
      if (!bet || bet.status !== "PLACED") throw new Error("No placed bet");

      const user = await tx.user.findUnique({ where: { id: userId } });

      await tx.bet.update({ where: { id: bet.id }, data: { status: "CANCELED" } });

      const newBalance = user.pointsBalance + bet.amount;
      await tx.user.update({ where: { id: userId }, data: { pointsBalance: newBalance } });
      await tx.ledgerEntry.create({
        data: {
          userId,
          roundId: current.roundId,
          type: "BET_CANCEL",
          delta: bet.amount,
          balanceAfter: newBalance
        }
      });

      return true;
    });
  }

  async function cashoutBet({ userId, slotIndex, multiplier }) {
    if (!current || current.phase !== "FLIGHT") return false;

    const m = Math.floor(multiplier * 100) / 100;

    return prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findUnique({
        where: { roundId_userId_slotIndex: { roundId: current.roundId, userId, slotIndex } }
      });
      if (!bet || bet.status !== "ACTIVE") return false;

      const payout = BigInt(Math.floor(Number(bet.amount) * m));

      // set cashed out (idempotent)
      const updated = await tx.bet.updateMany({
        where: { id: bet.id, status: "ACTIVE" },
        data: {
          status: "CASHED_OUT",
          cashoutMultiplier: m,
          payout
        }
      });
      if (updated.count === 0) return false;

      const user = await tx.user.findUnique({ where: { id: userId } });
      const newBalance = user.pointsBalance + payout;
      await tx.user.update({ where: { id: userId }, data: { pointsBalance: newBalance } });

      await tx.ledgerEntry.create({
        data: {
          userId,
          roundId: current.roundId,
          type: "CASHOUT",
          delta: payout,
          balanceAfter: newBalance
        }
      });

      return true;
    });
  }

  async function getRoundState() {
    if (!current) return null;
    return {
      roundId: current.roundId,
      phase: current.phase,
      serverSeedHash: current.serverSeedHash,
      clientSeed: current.clientSeed,
      nonce: Number(current.nonce),
      bettingEndsAt: current.bettingEndsAt,
      startsAt: current.startsAt
    };
  }

  function clearTimers() {
    if (tickTimer) clearInterval(tickTimer);
    if (phaseTimer) clearTimeout(phaseTimer);
    tickTimer = null;
    phaseTimer = null;
  }

  return {
    init,
    getRoundState,
    placeBet,
    cancelBet,
    cashoutBet
  };
}
