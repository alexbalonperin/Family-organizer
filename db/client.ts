// Server-only Drizzle client. Uses postgres-js. Never import from a Client
// Component — Drizzle bundles will leak credentials if you do.

import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // Allow build/typecheck without a DB url; fail loudly only when actually used.
  // Server runtime imports will hit this branch and throw.
}

const queryClient = url ? postgres(url, { prepare: false }) : (null as never);

export const db = url
  ? drizzle(queryClient, { schema, logger: false })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(
            "DATABASE_URL is not set. Set it in .env.local before using db.*",
          );
        },
      },
    ) as ReturnType<typeof drizzle<typeof schema>>);

export { schema };
