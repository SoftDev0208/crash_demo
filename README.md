🎮 Crash & Limbo Game Demo

A BC.Game–style Crash & Limbo betting demo built with a modern full-stack setup.
This project demonstrates real-time crash gameplay, instant limbo bets, trend/history visualization, and JWT-based authentication, all powered by a single backend.

⚠️ Educational / demo purpose only
This project is not intended for real-money gambling or production use.

✨ Features
🔥 Crash Game

Real-time multiplier growth with WebSockets (Socket.IO)

Provably fair crash multiplier generation

Manual & auto cashout

Live bets panel

Balance updates per round

History strip & trend chart (BC.Game style)

🎯 Limbo Game

Instant bet resolution (no waiting)

Target multiplier & win chance linkage

Big center roll multiplier display

Win / lose feedback with profit calculation

Trend history popover (shared logic with Crash)

👤 Auth & Wallet

JWT authentication

Register / Login / Logout

Points balance stored as BigInt

Ledger entries for all balance changes

🧱 Tech Stack
Frontend

Next.js (App Router)

React + TypeScript

CSS Modules

Socket.IO client

Backend

Node.js + Express

Socket.IO (Crash real-time engine)

Prisma ORM

MySQL (InnoDB)

JWT authentication

Database

MySQL (via Prisma)

BigInt-safe balance & betting logic

📁 Project Structure
crash_demo/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express + Socket.IO entry
│   │   ├── gameEngine.js         # Crash game loop
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   └── limboRoutes.js
│   │   ├── services/
│   │   │   ├── bettingService.js
│   │   │   ├── limboService.js
│   │   │   └── balanceService.js
│   │   ├── utils/
│   │   │   └── serialize.js
│   │   └── db.js
│   └── prisma/
│       └── schema.prisma
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Crash page
│   │   ├── limbo/page.tsx        # Limbo page
│   │   └── auth/page.tsx
│   ├── components/
│   │   ├── CrashGraph.tsx
│   │   ├── CrashHistory.tsx
│   │   └── TrendPopover.tsx
│   └── lib/
│       ├── api.ts
│       ├── auth.ts
│       └── socket.ts

⚙️ Environment Configuration
1️⃣ Backend .env

Create backend/.env:

DATABASE_URL="mysql://root:@localhost:3306/crash_demo"
JWT_SECRET="crash_jwt_secret"

PORT=4000

HOUSE_EDGE=0.01
BETTING_MS=6000
COOLDOWN_MS=2000
TICK_MS=50


💡 Make sure MySQL is running and the database exists.

2️⃣ Frontend .env.local

Create frontend/.env.local:

NEXT_PUBLIC_API_BASE=http://localhost:4000

🗄️ Database Setup

From backend/:

npm install
npx prisma generate
npx prisma migrate dev --name init


If you already changed the schema:

npx prisma migrate reset

▶️ Running the Project
Backend
cd backend
npm run dev


Server runs on:

http://localhost:4000

Frontend
cd frontend
npm install
npm run dev


App runs on:

http://localhost:3000

🧪 How to Use

Open http://localhost:3000/auth

Register or login

Go to / for Crash

Go to /limbo for Limbo

Place bets, watch balance & trends update in real time

🔐 Provably Fair Notes

Crash uses server seed + client seed + nonce

Limbo uses random roll logic with house edge

Seeds & multipliers are stored per round/bet for auditability

🚧 Known Limitations

No production hardening

No rate limiting

No real payments

Single-instance game engine (no clustering)

📜 License

MIT License
Use freely for learning, demos, or experimentation.