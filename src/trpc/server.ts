import { initTRPC } from "@trpc/server";
import type * as vscode from "vscode";

export type Context = { vscode: typeof vscode };

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
