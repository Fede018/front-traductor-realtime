import type { LanguageCode } from "../types/language";
import type { AudioUploadResponse } from "./audioClient";

type ResultMessage = { type: "result" } & AudioUploadResponse;
type ErrorMessage = { type: "error"; detail: string };
type ServerMessage = ResultMessage | ErrorMessage;

type ResultCallback = (result: AudioUploadResponse) => void;
type ErrorCallback = (detail: string) => void;

function getSocketUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL as string;
  return base.replace(/^http/, "ws") + "/ws/audio";
}

type CloseCallback = () => void;

let socket: WebSocket | null = null;
let resultCallback: ResultCallback | null = null;
let errorCallback: ErrorCallback | null = null;
let closeCallback: CloseCallback | null = null;

function handleMessage(event: MessageEvent) {
  const message: ServerMessage = JSON.parse(event.data);
  if (message.type === "result") {
    const { type: _type, ...result } = message;
    resultCallback?.(result);
  } else {
    errorCallback?.(message.detail);
  }
}

export function connect(): Promise<WebSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return Promise.resolve(socket);
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(getSocketUrl());
    ws.addEventListener("open", () => {
      socket = ws;
      resolve(ws);
    });
    ws.addEventListener("message", handleMessage);
    ws.addEventListener("error", () => {
      reject(new Error("No se pudo conectar al servidor de streaming."));
    });
    ws.addEventListener("close", () => {
      if (socket === ws) {
        socket = null;
        closeCallback?.();
      }
    });
  });
}

export function sendStart(sourceLanguage: LanguageCode, targetLanguage: LanguageCode) {
  socket?.send(JSON.stringify({ type: "start", sourceLanguage, targetLanguage }));
}

export function sendChunk(chunk: Blob) {
  socket?.send(chunk);
}

export function sendStop() {
  socket?.send(JSON.stringify({ type: "stop" }));
}

export function onResult(callback: ResultCallback) {
  resultCallback = callback;
}

export function onError(callback: ErrorCallback) {
  errorCallback = callback;
}

export function onClose(callback: CloseCallback) {
  closeCallback = callback;
}

export function isConnected(): boolean {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}
