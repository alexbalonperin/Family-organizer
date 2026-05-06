// Used only for `drizzle-kit introspect` — pulling generated types from a live
// Supabase database. We do NOT use drizzle-kit to manage migrations; the SQL
// files in supabase/migrations/ are the source of truth.

import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./db/.drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
