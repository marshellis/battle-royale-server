import { describe, it, expect } from "vitest";
import { PlayerState } from "../schemas/PlayerState";
import { TeamState } from "../schemas/TeamState";
import { MatchState } from "../schemas/MatchState";
import { PartyState } from "../schemas/PartyState";

describe("schema defaults", () => {
  it("PlayerState starts alive, unknocked, at full HP, not a bot", () => {
    const p = new PlayerState();
    expect(p.hp).toBe(100);
    expect(p.alive).toBe(true);
    expect(p.knocked).toBe(false);
    expect(p.isBot).toBe(false);
    expect(p.teamId).toBe(-1);
  });

  it("TeamState starts with no members and not eliminated", () => {
    const t = new TeamState();
    expect(t.memberIds.length).toBe(0);
    expect(t.eliminated).toBe(false);
  });

  it("MatchState starts in the playing phase with an empty roster", () => {
    const m = new MatchState();
    expect(m.phase).toBe("playing");
    expect(m.players.size).toBe(0);
    expect(m.teams.size).toBe(0);
  });

  it("PartyState starts with no code, no leader, no members", () => {
    const p = new PartyState();
    expect(p.code).toBe("");
    expect(p.leaderId).toBe("");
    expect(p.members.size).toBe(0);
  });
});
