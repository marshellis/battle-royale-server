import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") displayName: string = "Anonymous";
  @type("boolean") isBot: boolean = false;
  @type("number") teamId: number = -1;

  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("number") yaw: number = 0;
  @type("number") pitch: number = 0;

  @type("number") hp: number = 100;
  @type("boolean") alive: boolean = true;   // false = fully dead (bled out or finished)
  @type("boolean") knocked: boolean = false;
  @type("number") bleedoutRemaining: number = 0;
  @type("string") weapon: string = "pistol";

  // Bot-only fields — unused (left at default) for real human players.
  @type("string") botState: string = "patrol"; // 'patrol'|'chase'|'attack'|'flee'|'revive'
  @type("string") targetId: string = "";
  @type("number") aiTimer: number = 0;
  @type("number") fireCooldown: number = 0;
  @type("number") speed: number = 7.5;
  @type("number") accuracy: number = 0.5;
  @type("number") aggroRadius: number = 70;
  @type("number") strafeDir: number = 1;
  @type("number") strafeTimer: number = 0;
}
