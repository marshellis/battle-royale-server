import { MatchState } from "../schemas/MatchState";
import { PlayerState } from "../schemas/PlayerState";
import { EnvBox } from "./mapGeneration";
import { BotEntity, TargetEntity, decideBotState, computeBotMovement, computeBotShot } from "./botAI";
import { applyHit, canStartRevive, startRevive, tickRevive, ReviveChannel } from "./combat";
import { WEAPONS, BOT_AI_TICK_SECONDS, REVIVE_CHANNEL_SECONDS } from "./constants";

function toBotEntity(p: PlayerState): BotEntity {
  return {
    x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, teamId: p.teamId,
    state: p.botState as BotEntity["state"],
    aggroRadius: p.aggroRadius, speed: p.speed, accuracy: p.accuracy,
    strafeDir: p.strafeDir, strafeTimer: p.strafeTimer,
    fireCooldown: p.fireCooldown, weapon: p.weapon,
  };
}

function toTargetEntity(id: string, p: PlayerState): TargetEntity {
  return { id, kind: p.isBot ? "bot" : "player", teamId: p.teamId, x: p.x, z: p.z, alive: p.alive, knocked: p.knocked };
}

export class BotManager {
  private reviveChannels = new Map<string, ReviveChannel>(); // keyed by reviverId

  constructor(private state: MatchState, private envObjects: EnvBox[]) {}

  tick(dt: number): void {
    const allEntities: { id: string; player: PlayerState }[] = [];
    this.state.players.forEach((p, id) => allEntities.push({ id, player: p }));
    const targets: TargetEntity[] = allEntities.map(({ id, player }) => toTargetEntity(id, player));

    for (const { id, player: bot } of allEntities) {
      if (!bot.isBot || !bot.alive || bot.knocked) continue;

      const botEntity = toBotEntity(bot);
      const currentTarget = targets.find((t) => t.id === bot.targetId) ?? null;
      const others = targets.filter((t) => t.id !== id);

      bot.aiTimer -= dt;
      let target = currentTarget;
      if (bot.aiTimer <= 0) {
        const decision = decideBotState(botEntity, currentTarget, others, this.envObjects);
        bot.botState = decision.state;
        bot.targetId = decision.target?.id ?? "";
        target = decision.target;
        bot.aiTimer = BOT_AI_TICK_SECONDS;
        botEntity.state = decision.state;
      }

      const moved = computeBotMovement(botEntity, target, dt, this.envObjects);
      bot.x = moved.x; bot.z = moved.z; bot.yaw = moved.yaw;
      bot.strafeDir = moved.strafeDir; bot.strafeTimer = moved.strafeTimer;

      if (bot.fireCooldown > 0) bot.fireCooldown -= dt;
      const shot = computeBotShot({ ...botEntity, fireCooldown: bot.fireCooldown }, target, WEAPONS);
      if (shot) {
        bot.fireCooldown = WEAPONS[bot.weapon].fireRate * (1 / bot.accuracy) * 0.5;
        const targetPlayer = this.state.players.get(shot.targetId);
        if (targetPlayer) applyHit({ teamId: bot.teamId }, targetPlayer, shot.damage);
      }

      if (bot.botState === "revive" && target) {
        const targetPlayer = this.state.players.get(target.id);
        if (targetPlayer && canStartRevive({ teamId: bot.teamId, x: bot.x, z: bot.z }, targetPlayer)) {
          let channel = this.reviveChannels.get(id);
          if (!channel || channel.targetId !== target.id) {
            channel = startRevive(target.id, id);
            this.reviveChannels.set(id, channel);
          }
          channel.remaining -= dt;
          if (tickRevive(channel, targetPlayer) === "complete") {
            this.reviveChannels.delete(id);
          }
        } else {
          this.reviveChannels.delete(id);
        }
      } else {
        this.reviveChannels.delete(id);
      }
    }
  }
}
