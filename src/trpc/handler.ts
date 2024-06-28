import type { Operation } from "@trpc/client";
import type { TRPCErrorResponse, TRPCResponseMessage } from "@trpc/server/rpc";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { Context } from "./server";
import { appRouter } from "./router";

export async function handlePostMessageRequest(
  message: Operation,
  context: Context,
  postMessage: (response: TRPCResponseMessage) => void
) {
  console.log("handlePostMessageRequest", message);
  const { id, type, path, input } = message;
  const caller = appRouter.createCaller(context);
  try {
    const result = await caller[path as keyof typeof caller](
      // @ts-expect-error
      input
    );
    console.log("result", result);
    postMessage({
      id,
      result: {
        type: "data",
        data: result,
      },
    } satisfies TRPCResponseMessage);
  } catch (err) {
    if (err instanceof TRPCError) {
      const httpStatusCode = getHTTPStatusCodeFromError(err);
      postMessage({
        id,
        error: {
          // @ts-expect-error
          code: err.code,
          message: err.message,
          data: {},
        },
      } satisfies TRPCResponseMessage);
      return;
    } else {
      postMessage({
        id,
        error: {
          // @ts-expect-error
          code: 500,
          message: err instanceof Error ? err.message : "Unknown error",
          // @ts-ignore
          data: {},
        },
      } satisfies TRPCErrorResponse);
    }
  }
}
