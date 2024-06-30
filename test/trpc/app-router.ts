import { initTRPC } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

const t = initTRPC.create();

export const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello, ${input.name}!`;
    }),

  getData: t.procedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      return { id: input.id, data: `Mock data for ID ${input.id}` };
    }),

  updateData: t.procedure
    .input(z.object({ id: z.number(), newData: z.string() }))
    .mutation(({ input }) => {
      return { id: input.id, data: input.newData, updated: true };
    }),

  onUpdate: t.procedure
    .input(z.object({ id: z.number() }))
    .subscription(({ input }) => {
      return observable<{ id: number; data: string }>((emit) => {
        const timer = setInterval(() => {
          emit.next({
            id: input.id,
            data: `Updated data at ${new Date().toISOString()}`,
          });
        }, 1000);

        return () => {
          clearInterval(timer);
        };
      });
    }),
});

export type AppRouter = typeof appRouter;
