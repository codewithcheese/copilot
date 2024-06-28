import { z } from "zod";
import { publicProcedure, router } from "./server";

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
  tryError: publicProcedure.mutation(async ({ ctx }) => {
    console.log("tryError procedure");
    throw new Error("Something went wrong");
  }),
});
