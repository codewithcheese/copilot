import { createTRPCProxyClient, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./shared";
import type { TRPCResponseMessage } from "@trpc/server/rpc";

const vscode = acquireVsCodeApi();

const postMessageLink: TRPCLink<AppRouter> = () => {
  return ({ op }) => {
    return observable((observer) => {
      const id = Math.random().toString(36).substring(2);
      const messageHandler = (event: MessageEvent<TRPCResponseMessage>) => {
        const message = event.data;
        if (message.id === id) {
          window.removeEventListener("message", messageHandler);
          if ("result" in message) {
            observer.next({ result: { data: message.result } });
            observer.complete();
          } else {
            console.log("postMessageLink received error", message);
            // @ts-expect-error incomplete error handling
            observer.error(new Error(message.error.message));
          }
        }
      };

      console.log("postMessageLink sending message", op);

      window.addEventListener("message", messageHandler);
      vscode.postMessage({
        type: "trpc.request",
        id,
        path: op.path,
        input: op.input,
      });
      return () => {
        window.removeEventListener("message", messageHandler);
      };
    });
  };
};

function createTRPCClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [postMessageLink],
  });
}

export const trpc = createTRPCClient();
