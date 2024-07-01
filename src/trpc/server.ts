import type { AnyRouter } from "@trpc/server";
import type { Webview } from "vscode";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { BaseSocketPonyFill, socketServer } from "./common";

class VSCodeSocketPonyFill extends BaseSocketPonyFill {
  private webview: Webview;
  private listeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(webview: Webview) {
    super();
    this.webview = webview;
    this.webview.onDidReceiveMessage(this.handleMessage);
  }

  private handleMessage = (message: any) => {
    if (message.type === "message") {
      this.emit("message", message.data);
    } else if (message.type === "error") {
      this.emit("error", new Error(message.data));
    } else if (message.type === "close") {
      this.emit("close", message.data);
    }
  };

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
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(
          (l) => l !== onceListener
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
    this.webview.postMessage({ type: "message", data });
  }

  close(): void {
    this.webview.postMessage({ type: "close" });
    // Remove the message listener
    this.webview.onDidReceiveMessage(() => {});
  }
}

export function createVSCodeServer(webview: Webview) {
  return socketServer((onConnection) => {
    onConnection(new VSCodeSocketPonyFill(webview));
  });
}

export function applyTRPCHandler<TRouter extends AnyRouter>({
  router,
  createContext,
  webview,
}: {
  router: TRouter;
  createContext?: () => Promise<any>;
  webview: Webview;
}) {
  const wss = createVSCodeServer(webview);

  return applyWSSHandler({
    wss,
    router,
    createContext,
  });
}
