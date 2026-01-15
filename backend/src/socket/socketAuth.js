import { verifyJwt } from "../auth/jwt.js";

export function socketAuth(socket, next) {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization || "").replace("Bearer ", "");

  if (!token) return next(new Error("Missing token"));

  try {
    const decoded = verifyJwt(token);
    socket.user = decoded; // { userId }
    next();
  } catch {
    next(new Error("Invalid token"));
  }
}
