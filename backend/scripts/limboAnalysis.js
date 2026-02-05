import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gt10 = new Prisma.Decimal("10");
  const gt100 = new Prisma.Decimal("100");

  const [total, countGt10, countGt100] = await Promise.all([
    prisma.limboBet.count(),
    prisma.limboBet.count({ where: { rolledMultiplier: { gt: gt10 } } }),
    prisma.limboBet.count({ where: { rolledMultiplier: { gt: gt100 } } }),
  ]);

  const pct = (n, d) => (d === 0 ? "0.00" : ((n / d) * 100).toFixed(2));

  console.log("=== Limbo rolledMultiplier analysis ===");
  console.log({ total });
  console.log({ countGt10, pctGt10: `${pct(countGt10, total)}%` });
  console.log({ countGt100, pctGt100: `${pct(countGt100, total)}%` });

  const top100 = await prisma.limboBet.findMany({
    where: { rolledMultiplier: { gt: gt100 } },
    orderBy: { rolledMultiplier: "desc" },
    take: 25,
    select: {
      id: true,
      userId: true,
      amount: true,
      targetMultiplier: true,
      rolledMultiplier: true,
      win: true,
      profit: true,
      createdAt: true,
    },
  });

  console.log("\n=== Top rolledMultiplier > 100 (top 25) ===");
  for (const b of top100) {
    console.log({
      id: b.id,
      userId: b.userId,
      rolledMultiplier: b.rolledMultiplier?.toString?.() ?? String(b.rolledMultiplier),
      targetMultiplier: b.targetMultiplier?.toString?.() ?? String(b.targetMultiplier),
      amount: b.amount?.toString?.() ?? String(b.amount),
      win: b.win,
      profit: b.profit?.toString?.() ?? String(b.profit),
      createdAt: b.createdAt,
    });
  }

  // Optional: who hits >100 the most
  const topUsers = await prisma.limboBet.groupBy({
    by: ["userId"],
    where: { rolledMultiplier: { gt: gt100 } },
    _count: { _all: true },
    orderBy: { _count: { _all: "desc" } },
    take: 10,
  });

  console.log("\n=== Users with most rolledMultiplier > 100 ===");
  for (const u of topUsers) {
    console.log({ userId: u.userId, count: u._count._all });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
