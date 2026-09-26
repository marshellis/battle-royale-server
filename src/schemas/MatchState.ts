import { Schema, type, MapSchema } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { TeamState } from "./TeamState";

export class MatchState extends Schema {
  @type("string") mode: string = "duos";
  @type("string") phase: string = "playing"; // 'playing' | 'over'
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: TeamState }) teams = new MapSchema<TeamState>();

  @type("number") stormRadius: number = 0;
  @type("number") stormTargetRadius: number = 0;
  @type("number") stormShrinkTimer: number = 0;
  @type("number") stormShrinkCount: number = 0;

  @type("string") winningTeamId: string = "";
}
