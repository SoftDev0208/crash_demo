import { io } from "socket.io-client";

export function makeCrashSocket({ baseUrl, token }) {
  return io(`${baseUrl}/crash`, {
    transports: ["websocket"],
    auth: { token }
  });
}
