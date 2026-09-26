import { describe, it, expect } from "vitest";
import { hasLOS, botWallCollision, decideBotState, computeBotMovement, computeBotShot, BotEntity, TargetEntity } from "../game/botAI";
import { EnvBox } from "../game/mapGeneration";
import { WEAPONS } from "../game/constants";

function bot(overrides: Partial<BotEntity> = {}): BotEntity {
  return {
    x: 0, z: 0, yaw: 0, hp: 100, teamId: 0, state: "patrol",
    aggroRadius: 70, speed: 7.5, accuracy: 0.5, strafeDir: 1, strafeTimer: 0,
    fireCooldown: 0, weapon: "pistol",
    ...overrides,
  };
}

function target(overrides: Partial<TargetEntity> = {}): TargetEntity {
  return { id: "t1", kind: "player", teamId: 1, x: 10, z: 0, alive: true, knocked: false, ...overrides };
}

describe("hasLOS", () => {
  it("is true with no obstacles", () => {
    expect(hasLOS(0, 0, 10, 0, [])).toBe(true);
  });

  it("is false when a box sits directly on the line", () => {
    const box: EnvBox = { x: 5, z: 0, w: 1, d: 1 };
    expect(hasLOS(0, 0, 10, 0, [box])).toBe(false);
  });

  it("is true when a box is off to the side", () => {
    const box: EnvBox = { x: 5, z: 10, w: 1, d: 1 };
    expect(hasLOS(0, 0, 10, 0, [box])).toBe(true);
  });
});

describe("botWallCollision", () => {
  it("is true inside a box's footprint", () => {
    const box: EnvBox = { x: 0, z: 0, w: 2, d: 2 };
    expect(botWallCollision(1, 1, [box])).toBe(true);
  });

  it("is false outside every box", () => {
    const box: EnvBox = { x: 0, z: 0, w: 2, d: 2 };
    expect(botWallCollision(10, 10, [box])).toBe(false);
  });
});

describe("decideBotState", () => {
  it("flees below 25 HP regardless of nearby enemies", () => {
    const b = bot({ hp: 10 });
    const result = decideBotState(b, null, [target({ x: 5, z: 0 })], []);
    expect(result.state).toBe("flee");
  });

  it("attacks a visible enemy within 15 units", () => {
    const b = bot();
    const t = target({ x: 10, z: 0 });
    const result = decideBotState(b, null, [t], []);
    expect(result.state).toBe("attack");
    expect(result.target).toBe(t);
  });

  it("chases a visible enemy beyond 15 units but within aggro radius", () => {
    const b = bot();
    const t = target({ x: 40, z: 0 });
    const result = decideBotState(b, null, [t], []);
    expect(result.state).toBe("chase");
  });

  it("ignores a teammate as a target", () => {
    const b = bot({ teamId: 1 });
    const t = target({ teamId: 1, x: 5, z: 0 });
    const result = decideBotState(b, null, [t], []);
    expect(result.state).toBe("patrol");
  });

  it("does not target through a wall (no LOS)", () => {
    const b = bot();
    const t = target({ x: 10, z: 0 });
    const wall: EnvBox = { x: 5, z: 0, w: 1, d: 1 };
    const result = decideBotState(b, null, [t], [wall]);
    expect(result.state).toBe("patrol");
  });

  it("reverts to patrol once its target dies", () => {
    const b = bot({ state: "attack" });
    const deadTarget = target({ alive: false });
    const result = decideBotState(b, deadTarget, [], []);
    expect(result.state).toBe("patrol");
    expect(result.target).toBeNull();
  });

  it("moves to revive a knocked teammate when no enemy threat is present", () => {
    const b = bot({ teamId: 1 });
    const downedTeammate = target({ teamId: 1, x: 8, z: 0, alive: true, knocked: true });
    const result = decideBotState(b, null, [downedTeammate], []);
    expect(result.state).toBe("revive");
    expect(result.target).toBe(downedTeammate);
  });

  it("prefers fighting a visible enemy over reviving a teammate", () => {
    const b = bot({ teamId: 1 });
    const enemy = target({ teamId: 2, x: 10, z: 0 });
    const downedTeammate = target({ teamId: 1, x: 8, z: 0, knocked: true });
    const result = decideBotState(b, null, [enemy, downedTeammate], []);
    expect(result.state).toBe("attack");
  });
});

describe("computeBotMovement", () => {
  it("moves toward its chase target", () => {
    const b = bot({ state: "chase" });
    const t = target({ x: 0, z: 10 });
    const result = computeBotMovement(b, t, 1, []);
    expect(result.z).toBeGreaterThan(0);
  });

  it("does not cross a wall in its path", () => {
    const b = bot({ state: "chase", x: 0, z: -4 });
    const t = target({ x: 0, z: 10 });
    const wall: EnvBox = { x: 0, z: 2, w: 5, d: 5 };
    const result = computeBotMovement(b, t, 1, [wall]);
    expect(result.z).toBe(-4);
  });
});

describe("computeBotShot", () => {
  it("does not shoot outside attack state", () => {
    const b = bot({ state: "chase" });
    expect(computeBotShot(b, target(), WEAPONS)).toBeNull();
  });

  it("does not shoot while on cooldown", () => {
    const b = bot({ state: "attack", fireCooldown: 1, accuracy: 1 });
    expect(computeBotShot(b, target(), WEAPONS)).toBeNull();
  });

  it("shoots a player target for 0.6x weapon damage at 100% accuracy", () => {
    const b = bot({ state: "attack", accuracy: 1, weapon: "pistol" });
    const result = computeBotShot(b, target({ kind: "player" }), WEAPONS);
    expect(result).toEqual({ targetId: "t1", damage: WEAPONS.pistol.damage * 0.6 });
  });

  it("shoots a bot target for 2.5x weapon damage at 100% accuracy", () => {
    const b = bot({ state: "attack", accuracy: 1, weapon: "pistol" });
    const result = computeBotShot(b, target({ kind: "bot" }), WEAPONS);
    expect(result).toEqual({ targetId: "t1", damage: WEAPONS.pistol.damage * 2.5 });
  });
});
