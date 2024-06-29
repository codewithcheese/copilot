import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  verbose: true,
  strict: true,
  dbCredentials: {
    url: "codewithcheese.db",
  },
} satisfies Config;
