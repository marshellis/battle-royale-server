import { defineConfig } from "vitest/config";

export default defineConfig({
  // fileParallelism: false — Colyseus's @colyseus/testing `boot()` always binds a
  // *fixed* port (2568), so two test files that each spin up a Colyseus test
  // server (PartyRoom.test.ts, MatchRoom.test.ts) collide with EADDRINUSE if
  // vitest runs them in parallel workers. Running test files sequentially avoids
  // the collision; within a file, tests already await colyseus.shutdown() in
  // afterEach before the next one boots.
  test: { globals: true, fileParallelism: false },
});
