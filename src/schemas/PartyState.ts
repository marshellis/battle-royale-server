import { Schema, type, MapSchema } from "@colyseus/schema";

export class PartyMemberState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") displayName: string = "Anonymous";
}

export class PartyState extends Schema {
  @type("string") code: string = "";
  @type("string") leaderId: string = "";
  @type("string") selectedMode: string = "duos";
  @type({ map: PartyMemberState }) members = new MapSchema<PartyMemberState>();
}
