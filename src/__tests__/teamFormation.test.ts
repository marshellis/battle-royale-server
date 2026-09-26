import { describe, it, expect } from "vitest";
import { formTeams } from "../game/teamFormation";

describe("formTeams", () => {
  it("gives a solo player 2 bot teammates in Trios, plus 32 all-bot teams", () => {
    const teams = formTeams(["p1"], 3, 33);
    expect(teams).toHaveLength(33);
    expect(teams[0]).toEqual({ id: 0, memberIds: ["p1"], botCount: 2 });
    for (const t of teams.slice(1)) {
      expect(t.memberIds).toEqual([]);
      expect(t.botCount).toBe(3);
    }
  });

  it("gives a full 4-person party no bots on their own Squads team, plus 24 all-bot teams", () => {
    const teams = formTeams(["p1", "p2", "p3", "p4"], 4, 25);
    expect(teams).toHaveLength(25);
    expect(teams[0]).toEqual({ id: 0, memberIds: ["p1", "p2", "p3", "p4"], botCount: 0 });
    expect(teams.slice(1).every((t) => t.botCount === 4 && t.memberIds.length === 0)).toBe(true);
  });

  it("splits a 4-person party choosing Duos into two full real teams of 2", () => {
    const teams = formTeams(["p1", "p2", "p3", "p4"], 2, 50);
    expect(teams).toHaveLength(50);
    expect(teams[0]).toEqual({ id: 0, memberIds: ["p1", "p2"], botCount: 0 });
    expect(teams[1]).toEqual({ id: 1, memberIds: ["p3", "p4"], botCount: 0 });
    expect(teams.slice(2).every((t) => t.botCount === 2 && t.memberIds.length === 0)).toBe(true);
  });

  it("splits a 3-person party choosing Duos into one full team and one bot-topped team", () => {
    const teams = formTeams(["p1", "p2", "p3"], 2, 50);
    expect(teams[0]).toEqual({ id: 0, memberIds: ["p1", "p2"], botCount: 0 });
    expect(teams[1]).toEqual({ id: 1, memberIds: ["p3"], botCount: 1 });
    expect(teams).toHaveLength(50);
  });

  it("assigns sequential, unique team ids", () => {
    const teams = formTeams(["p1", "p2", "p3", "p4", "p5"], 2, 50);
    const ids = teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(0);
  });
});
