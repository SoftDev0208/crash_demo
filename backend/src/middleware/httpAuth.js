import { verifyJwt } from "../auth/jwt.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = verifyJwt(token);
    req.user = decoded; // { userId }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
