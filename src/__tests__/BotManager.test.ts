import { describe, it, expect } from "vitest";
import { BotManager } from "../game/BotManager";
import { MatchState } from "../schemas/MatchState";
import { PlayerState } from "../schemas/PlayerState";

function makeBot(state: MatchState, id: string, opts: Partial<PlayerState>) {
  const p = new PlayerState();
  p.isBot = true;
  p.accuracy = 1; // deterministic for tests
  Object.assign(p, opts);
  state.players.set(id, p);
  return p;
}

function makeEnemyPlayer(state: MatchState, id: string, opts: Partial<PlayerState>) {
  const p = new PlayerState();
  p.isBot = false;
  Object.assign(p, opts);
  state.players.set(id, p);
  return p;
}

describe("BotManager", () => {
  it("moves a patrolling bot over time", () => {
    const state = new MatchState();
    const bot = makeBot(state, "b1", { teamId: 0, x: 0, z: 0, botState: "patrol" });
    const mgr = new BotManager(state, []);
    for (let i = 0; i < 30; i++) mgr.tick(0.1);
    expect(bot.x !== 0 || bot.z !== 0).toBe(true);
  });

  it("detects and attacks a nearby enemy, dealing damage over several ticks", () => {
    const state = new MatchState();
    const bot = makeBot(state, "b1", { teamId: 0, x: 0, z: 0, aggroRadius: 70, weapon: "rifle" });
    // hp set high enough that the target survives the full 50-tick window: with
    // accuracy=1 the bot's cooldown (rifle fireRate 0.12 * 0.5 = 0.06s) is shorter
    // than the tick's dt (0.1s), so it fires essentially every tick. A 100 HP target
    // would be killed by ~tick 9 and the bot would correctly revert to "patrol" per
    // decideBotState (no living enemy left) — that's correct AI behavior, but it
    // would make the "still attacking at tick 50" assertion below fail deterministically
    // regardless of RNG. Using a durable target instead keeps the engagement alive so
    // we can assert both the state transition and sustained damage.
    const enemy = makeEnemyPlayer(state, "p1", { teamId: 1, x: 5, z: 0, hp: 100000 });
    const mgr = new BotManager(state, []);
    for (let i = 0; i < 50; i++) mgr.tick(0.1); // 5 simulated seconds
    expect(bot.botState).toBe("attack");
    expect(enemy.hp).toBeLessThan(100000);
  });

  it("never damages a teammate", () => {
    const state = new MatchState();
    const bot = makeBot(state, "b1", { teamId: 0, x: 0, z: 0 });
    const teammate = makeEnemyPlayer(state, "p1", { teamId: 0, x: 5, z: 0, hp: 100 });
    const mgr = new BotManager(state, []);
    for (let i = 0; i < 50; i++) {
      mgr.tick(0.1);
      expect(teammate.hp).toBe(100);
    }
  });

  it("flees rather than attacks below 25 HP", () => {
    const state = new MatchState();
    const bot = makeBot(state, "b1", { teamId: 0, x: 0, z: 0, hp: 10 });
    makeEnemyPlayer(state, "p1", { teamId: 1, x: 5, z: 0 });
    const mgr = new BotManager(state, []);
    mgr.tick(0.1);
    expect(bot.botState).toBe("flee");
  });

  it("revives a knocked teammate within range after enough ticks", () => {
    const state = new MatchState();
    const bot = makeBot(state, "b1", { teamId: 0, x: 0, z: 0 });
    const downed = makeEnemyPlayer(state, "p1", {
      teamId: 0, x: 1, z: 0, hp: 0, alive: true, knocked: true, bleedoutRemaining: 30,
    });
    const mgr = new BotManager(state, []);
    for (let i = 0; i < 80; i++) mgr.tick(0.1); // enough time to path in and channel 4s
    expect(downed.knocked).toBe(false);
    expect(downed.hp).toBe(50);
  });
});
