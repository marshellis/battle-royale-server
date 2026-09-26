import { KNOCK_BLEEDOUT_SECONDS, REVIVE_CHANNEL_SECONDS, REVIVE_HP, REVIVE_RANGE } from "./constants";

export interface Combatant {
  hp: number;
  alive: boolean;    // false = fully dead (bled out or finished)
  knocked: boolean;
  teamId: number;
  bleedoutRemaining: number;
}

export type HitOutcome = "rejected-friendly-fire" | "rejected-dead" | "damaged" | "knocked" | "finished";

// The single place damage is ever applied to a player or bot. No-friendly-fire is
// enforced here, not just client-side, since this runs authoritatively on the server.
export function applyHit(attacker: { teamId: number }, target: Combatant, damage: number): HitOutcome {
  if (attacker.teamId === target.teamId) return "rejected-friendly-fire";
  if (!target.alive) return "rejected-dead";

  if (target.knocked) {
    target.alive = false;
    target.knocked = false;
    target.hp = 0;
    return "finished";
  }

  target.hp -= damage;
  if (target.hp <= 0) {
    target.hp = 0;
    target.knocked = true;
    target.bleedoutRemaining = KNOCK_BLEEDOUT_SECONDS;
    return "knocked";
  }
  return "damaged";
}

// Storm damage has no attacker (no friendly-fire check applies) and — a deliberate
// v1 simplification — never finishes an already-knocked player; it only knocks the
// still-standing.
export function applyEnvironmentalDamage(target: Combatant, damage: number): "damaged" | "knocked" | "no-effect" {
  if (!target.alive || target.knocked) return "no-effect";
  target.hp -= damage;
  if (target.hp <= 0) {
    target.hp = 0;
    target.knocked = true;
    target.bleedoutRemaining = KNOCK_BLEEDOUT_SECONDS;
    return "knocked";
  }
  return "damaged";
}

// Returns true the instant a knocked player's timer runs out with no revive.
export function tickBleedout(target: Combatant, dt: number): boolean {
  if (!target.knocked) return false;
  target.bleedoutRemaining -= dt;
  if (target.bleedoutRemaining <= 0) {
    target.alive = false;
    target.knocked = false;
    return true;
  }
  return false;
}

export function canStartRevive(
  reviver: { teamId: number; x: number; z: number },
  target: Combatant & { x: number; z: number },
): boolean {
  if (reviver.teamId !== target.teamId) return false;
  if (!target.knocked) return false;
  const dx = reviver.x - target.x, dz = reviver.z - target.z;
  return Math.sqrt(dx * dx + dz * dz) <= REVIVE_RANGE;
}

export interface ReviveChannel {
  targetId: string;
  reviverId: string;
  remaining: number;
}

export function startRevive(targetId: string, reviverId: string): ReviveChannel {
  return { targetId, reviverId, remaining: REVIVE_CHANNEL_SECONDS };
}

export function tickRevive(channel: ReviveChannel, target: Combatant): "channeling" | "complete" {
  if (channel.remaining <= 0) {
    target.hp = REVIVE_HP;
    target.knocked = false;
    target.bleedoutRemaining = 0;
    return "complete";
  }
  return "channeling";
}
