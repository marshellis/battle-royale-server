// src/__tests__/combat.test.ts
import { describe, it, expect } from "vitest";
import {
  applyHit, applyEnvironmentalDamage, tickBleedout, canStartRevive,
  startRevive, tickRevive, Combatant,
} from "../game/combat";

function combatant(overrides: Partial<Combatant> = {}): Combatant {
  return { hp: 100, alive: true, knocked: false, teamId: 1, bleedoutRemaining: 0, ...overrides };
}

describe("applyHit", () => {
  it("rejects damage between teammates", () => {
    const target = combatant();
    const outcome = applyHit({ teamId: 1 }, target, 50);
    expect(outcome).toBe("rejected-friendly-fire");
    expect(target.hp).toBe(100);
  });

  it("rejects damage to an already-dead target", () => {
    const target = combatant({ alive: false });
    expect(applyHit({ teamId: 2 }, target, 50)).toBe("rejected-dead");
  });

  it("reduces HP on a normal hit", () => {
    const target = combatant();
    expect(applyHit({ teamId: 2 }, target, 30)).toBe("damaged");
    expect(target.hp).toBe(70);
  });

  it("knocks instead of killing at 0 HP", () => {
    const target = combatant({ hp: 20 });
    const outcome = applyHit({ teamId: 2 }, target, 30);
    expect(outcome).toBe("knocked");
    expect(target.hp).toBe(0);
    expect(target.alive).toBe(true);
    expect(target.knocked).toBe(true);
    expect(target.bleedoutRemaining).toBe(30);
  });

  it("finishes an already-knocked target instantly on any further hit", () => {
    const target = combatant({ hp: 0, knocked: true, bleedoutRemaining: 15 });
    const outcome = applyHit({ teamId: 2 }, target, 1);
    expect(outcome).toBe("finished");
    expect(target.alive).toBe(false);
    expect(target.knocked).toBe(false);
  });
});

describe("applyEnvironmentalDamage", () => {
  it("knocks a standing player at 0 HP, same as a hit", () => {
    const target = combatant({ hp: 3 });
    expect(applyEnvironmentalDamage(target, 5)).toBe("knocked");
    expect(target.knocked).toBe(true);
  });

  it("has no effect on an already-knocked player", () => {
    const target = combatant({ hp: 0, knocked: true, bleedoutRemaining: 10 });
    expect(applyEnvironmentalDamage(target, 5)).toBe("no-effect");
    expect(target.bleedoutRemaining).toBe(10);
  });
});

describe("tickBleedout", () => {
  it("does nothing to a player who isn't knocked", () => {
    const target = combatant();
    expect(tickBleedout(target, 5)).toBe(false);
  });

  it("counts down without dying while time remains", () => {
    const target = combatant({ hp: 0, knocked: true, bleedoutRemaining: 30 });
    expect(tickBleedout(target, 10)).toBe(false);
    expect(target.bleedoutRemaining).toBe(20);
    expect(target.alive).toBe(true);
  });

  it("kills once the timer runs out", () => {
    const target = combatant({ hp: 0, knocked: true, bleedoutRemaining: 2 });
    expect(tickBleedout(target, 5)).toBe(true);
    expect(target.alive).toBe(false);
    expect(target.knocked).toBe(false);
  });
});

describe("canStartRevive", () => {
  it("requires the same team", () => {
    const target = combatant({ knocked: true }) as any;
    target.x = 0; target.z = 0;
    expect(canStartRevive({ teamId: 2, x: 0, z: 0 }, target)).toBe(false);
  });

  it("requires the target to actually be knocked", () => {
    const target = combatant({ knocked: false }) as any;
    target.x = 0; target.z = 0;
    expect(canStartRevive({ teamId: 1, x: 0, z: 0 }, target)).toBe(false);
  });

  it("requires proximity within REVIVE_RANGE (2.5 units)", () => {
    const target = combatant({ knocked: true }) as any;
    target.x = 0; target.z = 0;
    expect(canStartRevive({ teamId: 1, x: 2, z: 0 }, target)).toBe(true);
    expect(canStartRevive({ teamId: 1, x: 10, z: 0 }, target)).toBe(false);
  });
});

describe("revive channel", () => {
  it("completes and restores 50 HP once channel time elapses", () => {
    const target = combatant({ hp: 0, knocked: true, bleedoutRemaining: 12 }) as any;
    const channel = startRevive("victim", "reviver");
    expect(channel.remaining).toBe(4);
    channel.remaining = 0;
    const outcome = tickRevive(channel, target);
    expect(outcome).toBe("complete");
    expect(target.hp).toBe(50);
    expect(target.knocked).toBe(false);
    expect(target.bleedoutRemaining).toBe(0);
  });

  it("stays in the channeling state before time elapses", () => {
    const target = combatant({ hp: 0, knocked: true }) as any;
    const channel = startRevive("victim", "reviver");
    expect(tickRevive(channel, target)).toBe("channeling");
    expect(target.knocked).toBe(true);
  });
});
