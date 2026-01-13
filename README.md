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

crash-demo/
backend/
prisma/schema.prisma
src/
index.js
gameEngine.js
provablyFair.js
db.js
routes/
socket/
frontend/
src/
pages/
App.jsx
main.jsx
docker-compose.yml
README.md

yaml
Copy code

---

## Requirements

- Node.js 18+ (recommended)
- Docker + Docker Compose

---

## Quick Start

### 1) Start Postgres + Redis
From project root:

```bash
docker compose up -d
2) Backend setup
bash
Copy code
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
Backend runs at:

http://localhost:4000

Health check:

GET http://localhost:4000/health

3) Frontend setup
In a new terminal:

bash
Copy code
cd frontend
npm install
npm run dev
Frontend runs at the Vite URL shown in the terminal (usually http://localhost:5173).

Configuration
Backend config is in backend/.env:

bash
Copy code
PORT=4000
DATABASE_URL="postgresql://crash:crash@localhost:5432/crash?schema=public"
JWT_SECRET="change-me"
HOUSE_EDGE=0.01
BETTING_MS=6000
COOLDOWN_MS=2000
TICK_MS=50
Frontend config (optional):

Create frontend/.env:

bash
Copy code
VITE_API_BASE=http://localhost:4000
How to Play
Register (optionally enter a referral code)

Go to Crash

During BETTING, place Bet A and/or Bet B

During FLIGHT, press Cashout before the round CRASHES

Check:

Leaderboard for rankings

Bonuses to claim daily points

Referrals to view your code and check rewards

API Overview
REST endpoints
Auth

POST /api/auth/register { username, password, ref? }

POST /api/auth/login { username, password }

GET /api/auth/me (Bearer token)

Bonuses

GET /api/bonuses/status (Bearer token)

POST /api/bonuses/claim { type: "daily" } (Bearer token)

Referrals

GET /api/referrals/me (Bearer token)

POST /api/referrals/check-and-pay (Bearer token)

Leaderboard

GET /api/leaderboard?period=daily|weekly|allTime

WebSocket (Socket.IO)
Namespace: /crash

Server → Client

round:state { roundId, phase, serverSeedHash, clientSeed, nonce, bettingEndsAt, startsAt }

flight:tick { roundId, multiplier, elapsedMs }

round:crash { roundId, crashMultiplier, serverSeed, endedAt }

Client → Server

bet:place { roundId, slotIndex, amount, autoCashout }

bet:cancel { roundId, slotIndex }

bet:cashout { roundId, slotIndex }

Database (Prisma)
Main tables:

User (points balance, referral code)

Round (nonce, seed hash, crash multiplier, phase)

Bet (roundId, userId, slotIndex 0/1, amount, autoCashout)

LedgerEntry (tracks balance changes)

Bonus (daily claims)

ReferralReward (one-time payouts per referred user)

Known MVP Limitations / Next Improvements
Cashout multiplier source

In the skeleton, cashout should use the server’s in-memory multiplier (authoritative).

Add engine.getCurrentMultiplier() and use it in the socket handler.

Bet editing during betting

MVP keeps ledger clean by expecting 1 placement per slot per round.

You can add “edit bet” with refund+recharge logic in a transaction.

Fairness verification page

Add a /fairness route to reproduce crash multiplier from revealed seeds.

Security & scale

Rate limiting, anti-spam, better validation, and Redis-backed state as needed.

License
MIT (or replace with your preferred license).

makefile
Copy code
::contentReference[oaicite:0]{index=0}