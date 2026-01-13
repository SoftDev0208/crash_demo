# Crash Demo (Points) --- Node + React

A demo **Crash-style** game (points only) with **2 bet slots**,
real-time multiplier updates, **leaderboard**, **daily bonus**, and
**referrals**.

> This project is an original implementation inspired by the common
> "Crash" game mechanic (betting → multiplier rises → crash).\
> It does **not** copy any proprietary code/assets from third-party
> sites.

------------------------------------------------------------------------

## Features

### Crash game (demo points)

-   Rounds: **BETTING → FLIGHT → CRASH → COOLDOWN**
-   Real-time multiplier streaming via **Socket.IO**
-   **2 bet slots** per user (Bet A / Bet B)
-   Manual cashout (optional auto cashout stored on bet)

### Meta features

-   **Leaderboard** (daily / weekly / all-time)
-   **Daily bonus** (claim once per day)
-   **Referrals**
    -   Each user has a referral code
    -   Reward rule: referred user gets **5 cashouts** → referrer earns
        **+2000 points** (one-time)

### Provably fair (MVP)

-   Server publishes `serverSeedHash` at round start
-   Server reveals `serverSeed` after crash
-   Crash point is deterministic from `(serverSeed, clientSeed, nonce)`

------------------------------------------------------------------------

## Tech Stack

-   **Backend**: Node.js (Express), Socket.IO, Prisma
-   **Database**: Postgres
-   **Cache (optional)**: Redis
-   **Frontend**: React (Vite)

------------------------------------------------------------------------

## Project Structure

    crash-demo/
      backend/
        prisma/
          schema.prisma
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

------------------------------------------------------------------------

## Requirements

-   Node.js 18+
-   Docker + Docker Compose

------------------------------------------------------------------------

## Quick Start

### 1) Start Postgres + Redis

``` bash
docker compose up -d
```

### 2) Backend setup

``` bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

Backend runs at:

    http://localhost:4000

------------------------------------------------------------------------

### 3) Frontend setup

``` bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

    http://localhost:5173

------------------------------------------------------------------------

## License

MIT
