import { z } from "zod";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { initTRPC } from "@trpc/server";
import type * as vscode from "vscode";
import { observable } from "@trpc/server/observable";

export type Context = { vscode: typeof vscode };

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

function streamToObservable<T>(stream: ReadableStream<T>) {
  return observable<T>((emit) => {
    const reader = stream.getReader();

    function read() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            emit.complete();
          } else {
            emit.next(value);
            read();
          }
        })
        .catch((err) => emit.error(err));
    }

    read();

    return () => {
      reader.cancel();
    };
  });
}

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system", "tool"]),
      content: z.any(),
    })
  ),
  providerId: z.enum(["openai", "anthropic", "mistral", "google"]),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  modelName: z.string().default("gpt-3.5-turbo"),
});

const greetingSchema = z.object({
  name: z.string().min(1).max(50),
});

export const appRouter = router({
  greeting: publicProcedure.input(greetingSchema).query(({ input }) => {
    return `Hello, ${input.name}!`;
  }),
  openChatPanel: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.vscode.commands.executeCommand("codewithcheese.openChatPanel");
  }),
  chat: publicProcedure.input(chatSchema).subscription(async ({ input }) => {
    const { messages, providerId, apiKey, baseURL, modelName } = input;

    if (!providerId || !baseURL || !modelName) {
      throw Error(`Malformed request`, {
        cause: 400,
      });
    }

    let provider;
    switch (providerId) {
      case "openai":
        provider = createOpenAI({ apiKey, baseURL });
        break;
      case "anthropic":
        provider = createAnthropic({ apiKey });
        break;
      case "mistral":
        provider = createMistral({ apiKey, baseURL });
        break;
      case "google":
        provider = createGoogleGenerativeAI({ apiKey, baseURL });
        break;
      default:
        throw Error(`Unsupported provider ${providerId}`, {
          cause: 400,
        });
    }

    const result = await streamText({
      model: provider.chat(modelName),
      // @ts-expect-error issue with tool message types
      messages,
    });

    const stream = result.toAIStream();
    return streamToObservable(stream);
  }),
});
