import { prisma } from "../db.js";

export async function getUserBalance(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true },
  });
  return u?.pointsBalance?.toString?.() ?? "0";
}
