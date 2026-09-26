import { Schema, type, ArraySchema } from "@colyseus/schema";

export class TeamState extends Schema {
  @type("number") id: number = -1;
  @type(["string"]) memberIds = new ArraySchema<string>(); // sessionIds into MatchState.players
  @type("boolean") eliminated: boolean = false;
}
