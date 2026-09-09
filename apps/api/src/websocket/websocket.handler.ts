import type { WebSocket } from "ws";

export const webSocketHandler = (socket: WebSocket) => {
    console.log("Client connected");

    socket.on("message", (message) => {
        // handle websocket messages
    });

    socket.on("close", () => {
        console.log("Client disconnected");
    });
};