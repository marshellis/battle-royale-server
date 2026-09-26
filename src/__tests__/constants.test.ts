import { describe, it, expect } from "vitest";
import { MODE_CONFIG } from "../game/constants";

describe("MODE_CONFIG", () => {
  it("matches the design doc's team sizing table", () => {
    expect(MODE_CONFIG.duos).toEqual({ teamSize: 2, totalTeams: 50 });
    expect(MODE_CONFIG.trios).toEqual({ teamSize: 3, totalTeams: 33 });
    expect(MODE_CONFIG.squads).toEqual({ teamSize: 4, totalTeams: 25 });
  });
});
