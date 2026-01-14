export function registerCrashNamespace({ io, engine, authUserFromSocket }) {
  const nsp = io.of("/crash");

  nsp.on("connection", async (socket) => {
    const user = await authUserFromSocket(socket);
    socket.data.user = user; // may be null for spectators

    // Send current round state
    const state = await engine.getRoundState();
    if (state) socket.emit("round:state", state);

    socket.on("bet:place", async (payload, cb) => {
      try {
        if (!socket.data.user) throw new Error("Unauthorized");
        const { roundId, slotIndex, amount, autoCashout } = payload || {};
        // roundId is optional here (engine knows current); keep for client sanity
        const bet = await engine.placeBet({
          userId: socket.data.user.id,
          slotIndex,
          amount,
          autoCashout: autoCashout != null ? Number(autoCashout) : null
        });
        cb?.({ ok: true, bet });
      } catch (e) {
        cb?.({ ok: false, error: e.message });
      }
    });

    socket.on("bet:cancel", async (payload, cb) => {
      try {
        if (!socket.data.user) throw new Error("Unauthorized");
        const { slotIndex } = payload || {};
        await engine.cancelBet({ userId: socket.data.user.id, slotIndex });
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: e.message });
      }
    });

    socket.on("bet:cashout", async (payload, cb) => {
      try {
        if (!socket.data.user) throw new Error("Unauthorized");
        const { slotIndex } = payload || {};
        const ok = await engine.cashoutBet({
          userId: socket.data.user.id,
          slotIndex,
          multiplier: engine._lastMultiplier ?? 1.0
        });
        cb?.({ ok });
      } catch (e) {
        cb?.({ ok: false, error: e.message });
      }
    });
  });
}
