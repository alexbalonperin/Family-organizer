// Integration test bootstrap. Spawn `supabase start` in another terminal
// before running `npm run test:integration`.
//
// Tests in this directory should:
//   - read SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from local supabase
//     defaults (printed by `supabase start`)
//   - create a fresh household via seed_household per test (or per file
//     with afterAll cleanup)
//   - exercise RLS by signing in as different auth users via supabase-js
//
// AC #7 (reminder idempotency) and AC #8 (RLS smoke test) are the two
// integrations called out in the spec. Add them here.

import { afterAll, beforeAll } from "vitest";

beforeAll(() => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Integration tests need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env. Start `supabase start` and export the printed defaults.",
    );
  }
});

afterAll(() => {
  // Per-test cleanup is preferred; nothing global to do here yet.
});
