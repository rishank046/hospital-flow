import { WebSocketServer } from "ws";
import { webSocketHandler } from './websocket.handler.js'
export const setupWebSocket = (wss: WebSocketServer) => {
    wss.on("connection", webSocketHandler);
};