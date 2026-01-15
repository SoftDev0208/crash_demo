import { io, Socket } from "socket.io-client";
import { API_BASE } from "./api";

let socket: Socket | null = null;

export function connectCrashSocket(token: string): Socket {
  if (socket) return socket;

  socket = io(`${API_BASE}/crash`, {
    transports: ["websocket"],
    auth: { token },
  });

  return socket;
}

export function disconnectCrashSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
