import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import type { AppRouter } from "./shared";
import { BaseSocketPonyFill } from "./common.js";

export class VSCodeSocketPonyFill extends BaseSocketPonyFill {
  private vscode: any;
  private listeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor() {
    super();
    this.vscode = acquireVsCodeApi();
    window.addEventListener("message", this.handleMessage);
    // Simulate the WebSocket opening
    queueMicrotask(() => this.emit("open", new Event("open")));
  }

  private handleMessage = (event: MessageEvent) => {
    const message = event.data;
    if (message.type === "message") {
      this.emit("message", message);
    } else if (message.type === "error") {
      this.emit("error", new Error(message));
    } else if (message.type === "close") {
      this.emit("close", message);
    }
  };

  addEventListener(event: string, listener: EventListener): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener as any);
  }

  removeEventListener(event: string, listener: EventListener): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (l) => l !== listener
      );
    }
  }

  on(
    event: "message" | "error",
    listener: (message: string | Error) => void
  ): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return this;
  }

  once(event: "close", listener: (code: number) => void): this {
    const onceListener = (code: number) => {
      listener(code);
      // filter out the listener
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(
          (listener) => listener !== onceListener
        );
      }
    };
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(onceListener);
    return this;
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach((callback) => callback(data));
  }

  send(data: string): void {
    this.vscode.postMessage({ type: "message", data });
  }

  close(): void {
    this.vscode.postMessage({ type: "close" });
    window.removeEventListener("message", this.handleMessage);
  }
}

export function createVSCodeClient(): ReturnType<typeof createWSClient> {
  return createWSClient({
    url: "vscode" as unknown as string, // Dummy URL, not actually used
    WebSocket: VSCodeSocketPonyFill as unknown as typeof WebSocket,
  });
}

export function createTrpcClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      wsLink({
        client: createVSCodeClient(),
      }),
    ],
  });
}
