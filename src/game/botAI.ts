import { EnvBox } from "./mapGeneration";
import { MAP_SIZE, REVIVE_DETECT_RADIUS } from "./constants";

export interface BotEntity {
  x: number; z: number;
  yaw: number;
  hp: number;
  teamId: number;
  state: "patrol" | "chase" | "attack" | "flee" | "revive";
  aggroRadius: number;
  speed: number;
  accuracy: number;
  strafeDir: number;
  strafeTimer: number;
  fireCooldown: number;
  weapon: string;
}

export interface TargetEntity {
  id: string;
  kind: "player" | "bot";
  teamId: number;
  x: number;
  z: number;
  alive: boolean;   // false = fully dead
  knocked: boolean;
}

// Ported verbatim from hasLOS() — treats envObjects as opaque axis-aligned obstacles
// along the line from (fromX,fromZ) to (toX,toZ).
export function hasLOS(fromX: number, fromZ: number, toX: number, toZ: number, envObjects: EnvBox[]): boolean {
  for (const obj of envObjects) {
    const ddx = toX - fromX, ddz = toZ - fromZ;
    const dbx = obj.x - fromX, dbz = obj.z - fromZ;
    if (Math.abs(dbx) > obj.w * 4 && Math.abs(dbz) > obj.d * 4) continue;
    const lenSq = ddx * ddx + ddz * ddz + 0.001;
    const t = Math.max(0, Math.min(1, (dbx * ddx + dbz * ddz) / lenSq));
    const cx = fromX + t * ddx - obj.x, cz = fromZ + t * ddz - obj.z;
    if (Math.abs(cx) < obj.w + 0.2 && Math.abs(cz) < obj.d + 0.2) return false;
  }
  return true;
}

// Ground-level-only variant of checkWallCollision() — see the height-gating note above.
export function botWallCollision(nx: number, nz: number, envObjects: EnvBox[]): boolean {
  for (const obj of envObjects) {
    if (Math.abs(nx - obj.x) < obj.w + 0.4 && Math.abs(nz - obj.z) < obj.d + 0.4) return true;
  }
  return false;
}

export function decideBotState(
  bot: BotEntity,
  currentTarget: TargetEntity | null,
  allEntities: TargetEntity[],
  envObjects: EnvBox[],
): { state: BotEntity["state"]; target: TargetEntity | null } {
  if (currentTarget && !currentTarget.alive) {
    currentTarget = null;
  }

  if (bot.hp < 25) {
    return { state: "flee", target: currentTarget };
  }

  let nearestEnemy: TargetEntity | null = null;
  let nearestEnemyDist = bot.aggroRadius;
  for (const other of allEntities) {
    if (other.teamId === bot.teamId || !other.alive) continue;
    const dx = other.x - bot.x, dz = other.z - bot.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < nearestEnemyDist && hasLOS(bot.x, bot.z, other.x, other.z, envObjects)) {
      nearestEnemyDist = d;
      nearestEnemy = other;
    }
  }

  if (nearestEnemy && nearestEnemyDist < 15) return { state: "attack", target: nearestEnemy };
  if (nearestEnemy) return { state: "chase", target: nearestEnemy };

  let nearestDown: TargetEntity | null = null;
  let nearestDownDist = REVIVE_DETECT_RADIUS;
  for (const other of allEntities) {
    if (other.teamId !== bot.teamId || !other.alive || !other.knocked) continue;
    const dx = other.x - bot.x, dz = other.z - bot.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < nearestDownDist) {
      nearestDownDist = d;
      nearestDown = other;
    }
  }
  if (nearestDown) return { state: "revive", target: nearestDown };

  if (bot.state === "attack" || bot.state === "chase" || bot.state === "revive") {
    return { state: "patrol", target: null };
  }
  return { state: bot.state, target: currentTarget };
}

export function computeBotMovement(
  bot: BotEntity,
  target: TargetEntity | null,
  dt: number,
  envObjects: EnvBox[],
): { x: number; z: number; yaw: number; strafeDir: number; strafeTimer: number } {
  let tx = bot.x, tz = bot.z, yaw = bot.yaw;
  let strafeDir = bot.strafeDir, strafeTimer = bot.strafeTimer;

  if (bot.state === "patrol") {
    if (Math.random() < dt * 1.2) yaw += (Math.random() - 0.5) * 2.2;
    tx = bot.x + Math.sin(yaw) * bot.speed * dt * 0.75;
    tz = bot.z + Math.cos(yaw) * bot.speed * dt * 0.75;
  } else if ((bot.state === "chase" || bot.state === "revive") && target) {
    yaw = Math.atan2(target.x - bot.x, target.z - bot.z);
    tx = bot.x + Math.sin(yaw) * bot.speed * dt;
    tz = bot.z + Math.cos(yaw) * bot.speed * dt;
  } else if (bot.state === "attack" && target) {
    yaw = Math.atan2(target.x - bot.x, target.z - bot.z);
    strafeTimer -= dt;
    if (strafeTimer <= 0) {
      strafeDir = Math.random() > 0.5 ? 1 : -1;
      strafeTimer = 0.8 + Math.random() * 1.2;
    }
    const sYaw = yaw + (Math.PI / 2) * strafeDir;
    tx = bot.x + Math.sin(sYaw) * bot.speed * dt * 0.65;
    tz = bot.z + Math.cos(sYaw) * bot.speed * dt * 0.65;
  } else if (bot.state === "flee" && target) {
    yaw = Math.atan2(bot.x - target.x, bot.z - target.z);
    tx = bot.x + Math.sin(yaw) * bot.speed * dt * 1.2;
    tz = bot.z + Math.cos(yaw) * bot.speed * dt * 1.2;
  }

  const h = MAP_SIZE / 2 - 2;
  tx = Math.max(-h, Math.min(h, tx));
  tz = Math.max(-h, Math.min(h, tz));
  const finalX = botWallCollision(tx, bot.z, envObjects) ? bot.x : tx;
  const finalZ = botWallCollision(bot.x, tz, envObjects) ? bot.z : tz;
  return { x: finalX, z: finalZ, yaw, strafeDir, strafeTimer };
}

// Pure decision only — does not mutate fireCooldown or apply damage; the caller
// (BotManager, Task 7) is responsible for resetting fireCooldown and calling into
// the combat module (Task 6) when this returns non-null.
export function computeBotShot(
  bot: BotEntity,
  target: TargetEntity | null,
  weapons: Record<string, { damage: number }>,
): { targetId: string; damage: number } | null {
  if (bot.state !== "attack" || !target) return null;
  if (bot.fireCooldown > 0) return null;
  if (Math.random() > bot.accuracy) return null;
  const dmgMultiplier = target.kind === "player" ? 0.6 : 2.5; // matches original runBotShooting()
  return { targetId: target.id, damage: weapons[bot.weapon].damage * dmgMultiplier };
}
