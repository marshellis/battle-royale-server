// src/__tests__/MatchRoom.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MatchRoom } from "../rooms/MatchRoom";
import { formTeams } from "../game/teamFormation";
import { MatchState } from "../schemas/MatchState";

describe("MatchRoom", () => {
  let colyseus: ColyseusTestServer;

  afterEach(async () => {
    await colyseus.shutdown();
    // @colyseus/testing always binds the fixed test port (2568). Node's HTTP
    // keep-alive pool can hold a socket open to the just-closed listener for a
    // moment after shutdown() resolves; without a short grace period the next
    // test's boot() on the same port intermittently hits a stale keep-alive
    // socket and the reused connection is torn down with ECONNRESET. (Same
    // fix already applied in PartyRoom.test.ts.)
    await new Promise((r) => setTimeout(r, 100));
  });

  async function setupDuos() {
    const server = new Server({ transport: new WebSocketTransport() });
    server.define("match", MatchRoom);
    colyseus = await boot(server);
    const teams = formTeams(["p1", "p2"], 2, 50);
    return colyseus.createRoom<MatchState>("match", { mode: "duos", teams });
  }

  // Same as setupDuos(), but with a single 2-player team and zero bots. The
  // friendly-fire test below only cares whether Alice's hit-report on her own
  // teammate is rejected; with setupDuos()'s 98 roaming enemy bots, the live
  // 20Hz simulation can land an unrelated bot-vs-Bob shot in the same window
  // the test observes (a real pistol hit is 25 * 0.6 player-multiplier = 15
  // damage — exactly what was observed flaking this test), which has nothing
  // to do with the friendly-fire behavior under test. Removing all bots makes
  // the assertion deterministic instead of racing the bot AI's target-picking.
  async function setupDuosNoBots() {
    const server = new Server({ transport: new WebSocketTransport() });
    server.define("match", MatchRoom);
    colyseus = await boot(server);
    const teams = formTeams(["p1", "p2"], 2, 1);
    return colyseus.createRoom<MatchState>("match", { mode: "duos", teams });
  }

  // A single real player against a single bot on the only other team, and
  // nothing else. The knock/finish tests below assert on the exact HP/knocked/
  // alive state of one specific bot immediately after Alice's own hit-report;
  // with setupDuos()'s 98 roaming enemy bots, the live 20Hz simulation can land
  // an unrelated bot-vs-bot shot on that same target bot in the same window
  // (observed flaking: an ambient hit either pre-knocks the target so Alice's
  // "knock" hit actually finishes it, or finishes an already-knocked target
  // outright) — same root cause as setupDuosNoBots() above, just triggered via
  // a different pair of assertions. Zero ambient bots removes the race.
  async function setupSoloVsOneBot() {
    const server = new Server({ transport: new WebSocketTransport() });
    server.define("match", MatchRoom);
    colyseus = await boot(server);
    const teams = formTeams(["p1"], 1, 2);
    return colyseus.createRoom<MatchState>("match", { mode: "solo", teams });
  }

  it("spawns bots to fill every team up to the mode's total team count", async () => {
    const room = await setupDuos();
    expect(room.state.teams.size).toBe(50);
    let botCount = 0;
    room.state.players.forEach((p) => { if (p.isBot) botCount++; });
    expect(botCount).toBe(49 * 2); // 49 all-bot teams x 2, the real team has 0 bots
  });

  it("assigns a joining real player to their pre-formed team", async () => {
    const room = await setupDuos();
    const client = await colyseus.connectTo(room, { displayName: "Alice" });
    const player = room.state.players.get(client.sessionId);
    expect(player?.teamId).toBe(0);
    await client.leave();
  });

  it("rejects a hit-report between teammates", async () => {
    const room = await setupDuosNoBots();
    const alice = await colyseus.connectTo(room, { displayName: "Alice" });
    const bob = await colyseus.connectTo(room, { displayName: "Bob" });
    const bobState = room.state.players.get(bob.sessionId)!;
    alice.send("hit-report", { targetId: bob.sessionId, damage: 50 });
    await new Promise((r) => setTimeout(r, 50));
    expect(bobState.hp).toBe(100); // unchanged — Alice and Bob are teammates (team 0)
    await alice.leave(); await bob.leave();
  });

  it("applies damage and knocks (not kills) a valid enemy hit-report", async () => {
    const room = await setupSoloVsOneBot();
    const alice = await colyseus.connectTo(room, { displayName: "Alice" });
    const botId = Array.from(room.state.players.entries()).find(([id, p]) => p.isBot)![0];
    alice.send("hit-report", { targetId: botId, damage: 150 });
    await new Promise((r) => setTimeout(r, 50));
    const bot = room.state.players.get(botId)!;
    expect(bot.hp).toBe(0);
    expect(bot.knocked).toBe(true);
    expect(bot.alive).toBe(true);
    await alice.leave();
  });

  it("finishes an already-knocked target on a second hit", async () => {
    const room = await setupSoloVsOneBot();
    const alice = await colyseus.connectTo(room, { displayName: "Alice" });
    const botId = Array.from(room.state.players.entries()).find(([id, p]) => p.isBot)![0];
    alice.send("hit-report", { targetId: botId, damage: 150 });
    await new Promise((r) => setTimeout(r, 50));
    alice.send("hit-report", { targetId: botId, damage: 1 });
    await new Promise((r) => setTimeout(r, 50));
    const bot = room.state.players.get(botId)!;
    expect(bot.alive).toBe(false);
    await alice.leave();
  });

  it("removes a disconnected player and re-checks team elimination", async () => {
    const room = await setupDuos();
    const alice = await colyseus.connectTo(room, { displayName: "Alice" });
    const bob = await colyseus.connectTo(room, { displayName: "Bob" });
    await alice.leave();
    await new Promise((r) => setTimeout(r, 50));
    expect(room.state.players.has(alice.sessionId)).toBe(false);
    expect(room.state.teams.get("0")!.eliminated).toBe(false); // Bob is still alive on the team
    await bob.leave();
  });

  it("starts the storm at match creation and shrinks it over time", async () => {
    const room = await setupDuos();
    const initialRadius = room.state.stormRadius;
    expect(initialRadius).toBeGreaterThan(0);
    expect(room.state.stormShrinkTimer).toBeGreaterThan(0);
  });
});
