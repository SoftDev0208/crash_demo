# 🎮 Crash & Limbo Demo (Points Game)

A **Crash + Limbo demo game** built with **Node.js, Socket.IO, Prisma, MySQL, and Next.js**.  
This project is **points-only** (no real money) and designed for **learning, demos, and experimentation**.

> Inspired by popular Crash & Limbo mechanics (e.g. BC-style games),  
> but implemented **from scratch** with original code and UI.

---

## ✨ Features

### 🚀 Crash Game
- Game phases: **BETTING → FLIGHT → CRASH → COOLDOWN**
- Real-time multiplier updates via **Socket.IO**
- Manual & auto cashout
- Live bets panel
- Crash graph with animated multiplier
- History bar + trend view (popover)
- Provably fair crash multiplier

### 🎯 Limbo Game
- Adjustable **bet amount**
- Adjustable **target multiplier**
- Automatic win chance calculation
- Instant roll result
- Centered roll multiplier display
- Profit / loss feedback
- Trend history (same logic as Crash)

### 👤 User System
- JWT authentication (register / login)
- Points balance
- Referral codes
- Ledger-based balance updates
- Shared balance across Crash & Limbo

---

## 🧠 Provably Fair (Crash & Limbo)

- Server generates a **server seed**
- Hash of server seed is published before round
- Final multiplier is derived from:
    serverSeed + clientSeed + nonce
- Server seed is revealed after crash
- Same crash math can be reused by Limbo

---

## 🛠 Tech Stack

### Backend
- **Node.js**
- **Express**
- **Socket.IO**
- **Prisma ORM**
- **MySQL**
- **JWT Authentication**

### Frontend
- **Next.js (App Router)**
- **TypeScript**
- **CSS Modules**
- **WebSockets (Socket.IO client)**

---

## 📁 Project Structure
```text
crash_demo/
├── backend/
│ ├── prisma/
│ │ └── schema.prisma
│ └── src/
│ ├── index.js # Express + Socket.IO entry
│ ├── gameEngine.js # Crash game loop
│ ├── provablyFair.js # Crash / Limbo math
│ ├── db.js # Prisma client
│ ├── routes/
│ │ ├── authRoutes.js
│ │ └── limboRoutes.js
│ ├── services/
│ │ ├── bettingService.js
│ │ ├── limboService.js
│ │ └── balanceService.js
│ └── utils/
│ └── serialize.js
│
├── frontend/
│ ├── app/
│ │ ├── page.tsx # Crash page
│ │ ├── limbo/page.tsx # Limbo page
│ │ └── auth/page.tsx
│ ├── components/
│ │ ├── CrashGraph.tsx
│ │ ├── CrashHistory.tsx
│ │ └── TrendPopover.tsx
│ └── lib/
│ ├── api.ts
│ ├── auth.ts
│ └── socket.ts
│
└── README.md
```

---

## ⚙️ Environment Configuration

### Backend `.env`

Create `backend/.env`:

```env
DATABASE_URL="mysql://root:@localhost:3306/crash_demo"
JWT_SECRET="crash_jwt_secret"
PORT=4000

HOUSE_EDGE=0.01
BETTING_MS=6000
COOLDOWN_MS=2000
TICK_MS=50
```

### Frontend `.env`

Create `Create frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE=http://localhost:4000
```
---

## ▶️ Running the Project

### 1️⃣ Start MySQL
Make sure MySQL is running on port 3306.

### 2️⃣ Backend Setup

```
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```
#### Backend will run at:
```
http://localhost:4000
```

### 3️⃣ Frontend Setup

```
cd frontend
npm install
npm run dev
```
#### Frontend will run at:
```
http://localhost:3000
```

## 🧪 Demo Notes

- 💡 All bets use **virtual points**
- 🚫 No real money is used
- 🧪 Safe for testing and learning purposes
- 🔧 Easy to extend with:
  - Auto betting
  - Statistics & analytics
  - Leaderboards
  - Animations & effects

## 📜 License
 ### MIT License
 ### Free to use, modify, and learn from.





