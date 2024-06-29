import { z } from "zod";
import { publicProcedure, router } from "./server";
import { StreamingTextResponse, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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
  chat: publicProcedure.input(chatSchema).query(async ({ input }) => {
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
    return new StreamingTextResponse(result.toAIStream());
  }),
});
