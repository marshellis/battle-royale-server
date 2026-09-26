export const MAP_SIZE = 500;
export const MAX_HP = 100;

export const STORM_DAMAGE = 5;       // HP per second outside storm
export const STORM_INTERVAL = 90;    // seconds between storm shrinks
export const STORM_SHRINKS = 8;      // number of times storm shrinks

export const BOT_AI_TICK_SECONDS = 0.1; // AI decision rate — matches the client's original 10fps throttle
export const PARTY_BOT_ACCURACY = 0.5;
export const PARTY_BOT_SPEED = 7.5;
export const PARTY_BOT_AGGRO_RADIUS = 70;
export const REVIVE_DETECT_RADIUS = 40; // how far a bot will path to revive a knocked teammate

export const KNOCK_BLEEDOUT_SECONDS = 30;
export const REVIVE_CHANNEL_SECONDS = 4;
export const REVIVE_HP = 50;
export const REVIVE_RANGE = 2.5;

export const STATE_BROADCAST_HZ = 15;

export interface WeaponSpec { damage: number; fireRate: number; range: number; }

export const WEAPONS: Record<string, WeaponSpec> = {
  pistol:  { damage: 25, fireRate: 0.6,  range: 200 },
  rifle:   { damage: 20, fireRate: 0.12, range: 300 },
  shotgun: { damage: 80, fireRate: 0.9,  range: 30  },
  sniper:  { damage: 95, fireRate: 1.5,  range: 500 },
  smg:     { damage: 12, fireRate: 0.08, range: 120 },
};

export interface ModeConfig { teamSize: number; totalTeams: number; }

export const MODE_CONFIG: Record<string, ModeConfig> = {
  duos:   { teamSize: 2, totalTeams: 50 },
  trios:  { teamSize: 3, totalTeams: 33 },
  squads: { teamSize: 4, totalTeams: 25 },
};
