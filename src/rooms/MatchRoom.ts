import { Room, Client } from "@colyseus/core";
import { MatchState } from "../schemas/MatchState";
import { PlayerState } from "../schemas/PlayerState";
import { TeamState } from "../schemas/TeamState";
import { FormedTeam } from "../game/teamFormation";
import { generateEnvObjects, EnvBox } from "../game/mapGeneration";
import { BotManager } from "../game/BotManager";
import { applyHit, applyEnvironmentalDamage, tickBleedout, canStartRevive, startRevive, tickRevive, ReviveChannel } from "../game/combat";
import {
  MAP_SIZE, MAX_HP, STORM_DAMAGE, STORM_INTERVAL, STORM_SHRINKS,
  PARTY_BOT_ACCURACY, PARTY_BOT_SPEED, PARTY_BOT_AGGRO_RADIUS, STATE_BROADCAST_HZ,
} from "../game/constants";

const TICK_MS = 1000 / 20; // 20Hz simulation — plenty for bot AI + storm, well above the 15Hz client broadcast rate

interface MatchOptions {
  mode: string;
  teams: FormedTeam[];
}

export class MatchRoom extends Room<MatchState> {
  private botManager!: BotManager;
  private envObjects!: EnvBox[];
  private reviveChannels = new Map<string, ReviveChannel>(); // keyed by reviverId (human-initiated)

  // FIFO queue of team ids awaiting a real-player connection, one entry per
  // FormedTeam.memberIds slot, in team order. See onJoin for why this exists
  // instead of matching on FormedTeam.memberIds directly: those ids come from
  // wherever the caller sourced them (e.g. PartyRoom's own sessionIds), but
  // Colyseus's seat-reservation flow always mints a brand-new, unrelated
  // sessionId for the actual match-room connection — there is no API to pin it
  // to a caller-supplied value. So a real player's *eventual* client.sessionId
  // can never be found in FormedTeam.memberIds; slots must instead be consumed
  // in join order.
  private pendingRealSlots: number[] = [];
  // How many not-yet-joined real slots each team still has. While this is > 0
  // for a team, checkTeamEliminations must not treat that team as eliminated
  // just because its (still-empty) real slots have no PlayerState yet.
  private pendingByTeam = new Map<number, number>();

  onCreate(options: MatchOptions) {
    this.setState(new MatchState());
    this.state.mode = options.mode;
    this.envObjects = generateEnvObjects();

    for (const team of options.teams) {
      const teamState = new TeamState();
      teamState.id = team.id;
      this.state.teams.set(String(team.id), teamState);

      // Real players' PlayerState is created in onJoin (once they actually
      // connect); memberIds only ever holds ids that exist in state.players
      // (bots now, real players once joined) — see onJoin.
      for (let i = 0; i < team.memberIds.length; i++) {
        this.pendingRealSlots.push(team.id);
      }
      this.pendingByTeam.set(team.id, team.memberIds.length);

      for (let i = 0; i < team.botCount; i++) {
        const botId = `bot-${team.id}-${i}`;
        const bot = this.makeBot(team.id, botId);
        this.state.players.set(botId, bot);
        teamState.memberIds.push(botId);
      }
    }

    this.botManager = new BotManager(this.state, this.envObjects);
    this.initStorm();

    this.onMessage("state", (client: Client, data: { x: number; y: number; z: number; yaw: number; pitch: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.alive) return;
      p.x = data.x; p.y = data.y; p.z = data.z; p.yaw = data.yaw; p.pitch = data.pitch;
    });

    this.onMessage("hit-report", (client: Client, data: { targetId: string; damage: number }) => {
      const attacker = this.state.players.get(client.sessionId);
      const target = this.state.players.get(data.targetId);
      if (!attacker || !attacker.alive || !target) return;
      const outcome = applyHit(attacker, target, data.damage);
      if (outcome === "finished" || outcome === "damaged" || outcome === "knocked") {
        this.cancelChannelsInvolving(data.targetId);
      }
      this.checkTeamEliminations();
    });

    this.onMessage("revive-start", (client: Client, data: { targetId: string }) => {
      const reviver = this.state.players.get(client.sessionId);
      const target = this.state.players.get(data.targetId);
      if (!reviver || !reviver.alive || reviver.knocked || !target) return;
      if (!canStartRevive(reviver, target)) return;
      this.reviveChannels.set(client.sessionId, startRevive(data.targetId, client.sessionId));
    });

    this.onMessage("revive-cancel", (client: Client) => {
      this.reviveChannels.delete(client.sessionId);
    });

    this.setSimulationInterval((dtMs) => this.update(dtMs / 1000), TICK_MS);
  }

  private makeBot(teamId: number, sessionId: string): PlayerState {
    const bot = new PlayerState();
    bot.sessionId = sessionId;
    bot.isBot = true;
    bot.teamId = teamId;
    bot.accuracy = PARTY_BOT_ACCURACY;
    bot.speed = PARTY_BOT_SPEED;
    bot.aggroRadius = PARTY_BOT_AGGRO_RADIUS;
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 220;
    bot.x = Math.cos(angle) * dist;
    bot.z = Math.sin(angle) * dist;
    return bot;
  }

  onJoin(client: Client, options: { displayName?: string } = {}) {
    let p = this.state.players.get(client.sessionId);
    if (!p) {
      p = new PlayerState();
      p.sessionId = client.sessionId;
      const teamId = this.pendingRealSlots.shift();
      p.teamId = teamId ?? -1;
      if (teamId !== undefined) {
        this.state.teams.get(String(teamId))?.memberIds.push(client.sessionId);
        this.pendingByTeam.set(teamId, (this.pendingByTeam.get(teamId) ?? 1) - 1);
      }
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 220;
      p.x = Math.cos(angle) * dist;
      p.z = Math.sin(angle) * dist;
      this.state.players.set(client.sessionId, p);
    }
    p.displayName = options.displayName ?? "Anonymous";
  }

  onLeave(client: Client) {
    // No reconnection support (v1 scope) — the player's slot is simply removed;
    // their team continues shorthanded.
    this.state.players.delete(client.sessionId);
    this.reviveChannels.delete(client.sessionId);
    this.checkTeamEliminations();
  }

  private cancelChannelsInvolving(targetId: string) {
    for (const [reviverId, channel] of this.reviveChannels) {
      if (channel.targetId === targetId) this.reviveChannels.delete(reviverId);
    }
  }

  private initStorm() {
    this.state.stormRadius = MAP_SIZE * 0.5;
    this.state.stormTargetRadius = MAP_SIZE * 0.48;
    this.state.stormShrinkTimer = STORM_INTERVAL;
    this.state.stormShrinkCount = 0;
  }

  private updateStorm(dt: number) {
    this.state.stormShrinkTimer -= dt;
    if (this.state.stormShrinkTimer <= 0 && this.state.stormShrinkCount < STORM_SHRINKS) {
      this.state.stormShrinkCount++;
      this.state.stormRadius = this.state.stormTargetRadius;
      this.state.stormTargetRadius *= 0.6;
      this.state.stormShrinkTimer = STORM_INTERVAL;
    } else if (this.state.stormRadius > this.state.stormTargetRadius) {
      this.state.stormRadius = Math.max(this.state.stormTargetRadius, this.state.stormRadius - dt * 2);
    }

    this.state.players.forEach((p) => {
      if (!p.alive) return;
      const dist = Math.sqrt(p.x * p.x + p.z * p.z);
      if (dist > this.state.stormRadius) {
        applyEnvironmentalDamage(p, STORM_DAMAGE * dt);
      }
    });
  }

  private checkTeamEliminations() {
    this.state.teams.forEach((team) => {
      if (team.eliminated) return;
      if ((this.pendingByTeam.get(team.id) ?? 0) > 0) return; // still waiting on a real player to connect
      const allDead = team.memberIds.every((id) => {
        const p = this.state.players.get(id);
        return !p || !p.alive;
      });
      if (allDead) team.eliminated = true;
    });

    if (this.state.phase === "over") return;
    let remaining: string | null = null;
    let remainingCount = 0;
    this.state.teams.forEach((team, id) => {
      if (!team.eliminated) { remaining = id; remainingCount++; }
    });
    if (remainingCount <= 1 && remaining !== null) {
      this.state.phase = "over";
      this.state.winningTeamId = remaining;
    }
  }

  private update(dt: number) {
    if (this.state.phase !== "playing") return;

    this.botManager.tick(dt);
    this.updateStorm(dt);

    this.state.players.forEach((p) => {
      if (tickBleedout(p, dt)) this.cancelChannelsInvolving(p.sessionId);
    });

    for (const [reviverId, channel] of this.reviveChannels) {
      const reviver = this.state.players.get(reviverId);
      const target = this.state.players.get(channel.targetId);
      if (!reviver || !reviver.alive || !target || !canStartRevive(reviver, target)) {
        this.reviveChannels.delete(reviverId);
        continue;
      }
      channel.remaining -= dt;
      if (tickRevive(channel, target) === "complete") {
        this.reviveChannels.delete(reviverId);
      }
    }

    this.checkTeamEliminations();
  }
}
