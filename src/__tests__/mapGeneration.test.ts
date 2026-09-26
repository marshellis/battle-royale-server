import { describe, it, expect } from "vitest";
import { seededRand, getTerrainHeight, generateEnvObjects } from "../game/mapGeneration";

describe("seededRand", () => {
  it("is deterministic for a given seed", () => {
    expect(seededRand(42)).toBe(seededRand(42));
  });

  it("returns values in [0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const v = seededRand(i * 7.3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("getTerrainHeight", () => {
  it("is flat (0) within the 55-unit flat zone around the origin", () => {
    expect(getTerrainHeight(0, 0)).toBe(0);
    expect(getTerrainHeight(30, 20)).toBe(0);
  });

  it("is deterministic for the same coordinates", () => {
    expect(getTerrainHeight(120, -80)).toBe(getTerrainHeight(120, -80));
  });
});

describe("generateEnvObjects", () => {
  it("is fully deterministic — two calls produce identical layouts", () => {
    const a = generateEnvObjects();
    const b = generateEnvObjects();
    expect(a).toEqual(b);
  });

  it("produces a non-trivial number of collision boxes (buildings + trees + rocks)", () => {
    const objs = generateEnvObjects();
    // 20 building clusters (2-5 buildings each, 5 boxes/building) + up to 120 trees + 60 rocks
    expect(objs.length).toBeGreaterThan(100);
  });

  it("every box has finite, sane dimensions", () => {
    for (const o of generateEnvObjects()) {
      expect(Number.isFinite(o.x)).toBe(true);
      expect(Number.isFinite(o.z)).toBe(true);
      expect(o.w).toBeGreaterThan(0);
      expect(o.d).toBeGreaterThan(0);
    }
  });
});
