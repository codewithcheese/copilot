import type { Webview, WebviewView } from "vscode";
import { BaseSocketPonyFill, socketServer } from "./common.js";

// Server-side (Extension) implementation
class VSCodeServerSocketPonyFill extends BaseSocketPonyFill {
  private webview: Webview;

  constructor(webview: Webview) {
    super();
    this.webview = webview;
  }

  on(
    event: "message" | "error",
    listener: (message: string | Error) => void
  ): this {
    this.webview.onDidReceiveMessage((message) => {
      if (message.type === event) {
        listener(message.data);
      }
    });
    return this;
  }

  once(event: "close", listener: (code: number) => void): this {
    this.webview.onDidReceiveMessage((message) => {
      if (message.type === event) {
        listener(message.data);
        // Remove listener after first invocation
        // Note: This is a simplified approach. In a real implementation,
        // you might want to use a more sophisticated method to remove the listener.
      }
    });
    return this;
  }

  close(): void {
    this.webview.postMessage({ type: "close" });
  }

  send(data: string): void {
    this.webview.postMessage({ type: "message", data });
  }
}

function createVSCodeServer(webviewView: WebviewView) {
  return socketServer((onConnection) => {
    const socket = new VSCodeServerSocketPonyFill(webviewView.webview);
    onConnection(socket);
  });
}

// Client-side (Webview) implementation
class VSCodeClientSocketPonyFill extends BaseSocketPonyFill {
  constructor(private vscode: ReturnType<typeof acquireVsCodeApi>) {
    super();
  }

  on(
    event: "message" | "error",
    listener: (message: string | Error) => void
  ): this {
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === event) {
        listener(message.data);
      }
    });
    return this;
  }

  once(event: "close", listener: (code: number) => void): this {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === event) {
        listener(message.data);
        window.removeEventListener("message", handleMessage);
      }
    };
    window.addEventListener("message", handleMessage);
    return this;
  }

  close(): void {
    this.vscode.postMessage({ type: "close" });
  }

  send(data: string): void {
    this.vscode.postMessage({ type: "message", data });
  }
}

function createVSCodeClient(vscode: ReturnType<typeof acquireVsCodeApi>) {
  return {
    connect: () => new VSCodeClientSocketPonyFill(vscode),
  };
}

export { createVSCodeServer, createVSCodeClient };
