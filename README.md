# Crash Demo (Points) — Node + React

A demo **Crash-style** game (points only) with **2 bet slots**, real-time multiplier updates, **leaderboard**, **daily bonus**, and **referrals**.

> This project is an original implementation inspired by the common “Crash” game mechanic (betting → multiplier rises → crash).  
> It does **not** copy any proprietary code/assets from third-party sites.

---

## Features

### Crash game (demo points)
- Rounds: **BETTING → FLIGHT → CRASH → COOLDOWN**
- Real-time multiplier streaming via **Socket.IO**
- **2 bet slots** per user (Bet A / Bet B)
- Manual cashout (and optional auto cashout input stored on bet)

### Meta features
- **Leaderboard** (daily / weekly / all-time) based on ledger deltas
- **Daily bonus** (claim once per day)
- **Referrals**
  - Each user has a referral code
  - MVP reward rule: referred user gets **5 cashouts** → referrer earns **+2000 points** (one-time per referred user)

### Provably fair (MVP)
- Server publishes `serverSeedHash` at round start
- Server reveals `serverSeed` after crash in `round:crash`
- Crash point is deterministic from `(serverSeed, clientSeed, nonce)`  
  (You can add a `/fairness` page later to verify.)

---

## Tech Stack

- **Backend**: Node.js (Express), Socket.IO, Prisma
- **DB**: Postgres
- **Cache (optional)**: Redis
- **Frontend**: React (Vite), Socket.IO client

---

## Project Structure

- **backend/**
  - prisma/schema.prisma
  - src/
  - index.js
  - gameEngine.js
  - provablyFair.js
  - db.js
  - routes/
  - socket/
- **frontend/**
  - src/
  - pages/
  - App.jsx
  - main.jsx
- **docker-compose.yml**
- **README.md**

## Requirements

- Node.js 18+ (recommended)
- Docker + Docker Compose

---

## Quick Start