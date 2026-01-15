// Keep last N crash multipliers in memory (MVP)
const MAX = 25;
const history = []; // newest first

export function pushCrash(multiplier) {
  history.unshift(Number(multiplier));
  if (history.length > MAX) history.length = MAX;
}

export function getHistory() {
  return [...history];
}
