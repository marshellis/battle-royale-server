import { MAP_SIZE } from "./constants";

export interface EnvBox {
  x: number;
  z: number;
  w: number;
  d: number;
  maxY?: number;
}

interface Footprint { x: number; z: number; hw: number; hd: number; }

// Ported verbatim from fortnite-again/index.html's seededRand().
export function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// Ported verbatim from fortnite-again/index.html's getTerrainHeightMath().
export function getTerrainHeight(worldX: number, worldZ: number): number {
  const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
  const flatZone = 55;
  if (dist <= flatZone) return 0;
  const t = Math.max(0, Math.min(1, (dist - flatZone) / (MAP_SIZE * 0.30)));
  const vz = -worldZ;
  const h = Math.sin(worldX * 0.022) * 7
          + Math.cos(vz * 0.018) * 6
          + Math.sin(worldX * 0.009 + vz * 0.007) * 12
          + Math.sin(worldX * 0.042 + vz * 0.038) * 5
          + Math.cos(worldX * 0.085 + vz * 0.074) * 2;
  const outerT = Math.max(0, Math.min(1, (dist - MAP_SIZE * 0.36) / (MAP_SIZE * 0.12)));
  const outerBoost = outerT * outerT * 18;
  return (h + outerBoost) * t;
}

// Ported from addBuilding()'s collision-relevant lines only (materials/meshes dropped —
// server has no renderer). Pushes the same 5 wall-panel boxes the client registers:
// left wall, right wall, back wall, front-left door pier, front-right door pier.
function addBuildingCollision(envObjects: EnvBox[], footprints: Footprint[], x: number, z: number, seed: number) {
  const w = 6 + seededRand(seed)   * 10;
  const h = 4 + seededRand(seed + 1) * 12;
  const d = 6 + seededRand(seed + 2) * 10;
  footprints.push({ x, z, hw: w / 2 + 3, hd: d / 2 + 3 });

  const hw = w / 2, hd = d / 2;
  const groundY = Math.min(
    getTerrainHeight(x, z),
    getTerrainHeight(x - hw, z - hd),
    getTerrainHeight(x + hw, z - hd),
    getTerrainHeight(x - hw, z + hd),
    getTerrainHeight(x + hw, z + hd),
    getTerrainHeight(x - hw, z),
    getTerrainHeight(x + hw, z),
    getTerrainHeight(x, z - hd),
    getTerrainHeight(x, z + hd),
  );

  const doorW = 1.4;
  const doorH = 2.4;
  const doorSideW = (w - doorW) / 2;
  const doorSign = seededRand(seed + 7) > 0.5 ? 1 : -1;
  const frontZ = z + doorSign * (d / 2);
  const backZ  = z - doorSign * (d / 2);
  const wallThick = 0.3;
  const wallTopY = groundY + h;

  envObjects.push({ x: x - w / 2, z, w: wallThick / 2, d: d / 2, maxY: wallTopY });
  envObjects.push({ x: x + w / 2, z, w: wallThick / 2, d: d / 2, maxY: wallTopY });
  envObjects.push({ x, z: backZ, w: w / 2, d: wallThick / 2, maxY: wallTopY });
  envObjects.push({ x: x - doorW / 2 - doorSideW / 2, z: frontZ, w: doorSideW / 2, d: wallThick / 2, maxY: wallTopY });
  envObjects.push({ x: x + doorW / 2 + doorSideW / 2, z: frontZ, w: doorSideW / 2, d: wallThick / 2, maxY: wallTopY });
}

// Ported from addTree()'s envObjects.push line: h = 3 + seededRand(seed)*5.
function addTreeCollision(envObjects: EnvBox[], x: number, z: number, seed: number) {
  const y = getTerrainHeight(x, z);
  const h = 3 + seededRand(seed) * 5;
  envObjects.push({ x, z, w: 0.5, d: 0.5, maxY: y + h });
}

// Ported from addRock()'s envObjects.push line: s = 0.7 + seededRand(seed)*2.2.
function addRockCollision(envObjects: EnvBox[], x: number, z: number, seed: number) {
  const y = getTerrainHeight(x, z);
  const s = 0.7 + seededRand(seed) * 2.2;
  envObjects.push({ x, z, w: s + 0.3, d: s + 0.3, maxY: y + s * 1.4 });
}

// Ported verbatim from generateEnvironment()'s three loops (buildings, trees, rocks),
// same seed sequence as the client so both land on the identical layout.
export function generateEnvObjects(): EnvBox[] {
  const envObjects: EnvBox[] = [];
  const footprints: Footprint[] = [];
  const rng = (i: number) => seededRand(i * 137.508 + 42);
  let seed = 0;

  for (let i = 0; i < 20; i++) {
    const angle = rng(seed++) * Math.PI * 2;
    const dist = 30 + rng(seed++) * 220;
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    const count = 2 + Math.floor(rng(seed++) * 4);
    for (let j = 0; j < count; j++) {
      const bx = cx + (rng(seed++) - 0.5) * 30;
      const bz = cz + (rng(seed++) - 0.5) * 30;
      if (Math.abs(bx) < MAP_SIZE / 2 - 10 && Math.abs(bz) < MAP_SIZE / 2 - 10) {
        const bSeed = seed++;
        const overlaps = footprints.some(
          (f) => Math.abs(bx - f.x) < f.hw + 8 && Math.abs(bz - f.z) < f.hd + 8,
        );
        if (!overlaps) addBuildingCollision(envObjects, footprints, bx, bz, bSeed);
      }
    }
  }

  for (let i = 0; i < 120; i++) {
    const angle = rng(seed++) * Math.PI * 2;
    const dist = 20 + rng(seed++) * 230;
    const treeSeed = seed++;
    const tx = Math.cos(angle) * dist;
    const tz = Math.sin(angle) * dist;
    const inBuilding = footprints.some((f) => Math.abs(tx - f.x) < f.hw && Math.abs(tz - f.z) < f.hd);
    if (!inBuilding) addTreeCollision(envObjects, tx, tz, treeSeed);
  }

  for (let i = 0; i < 60; i++) {
    const angle = rng(seed++) * Math.PI * 2;
    const dist = 15 + rng(seed++) * 240;
    addRockCollision(envObjects, Math.cos(angle) * dist, Math.sin(angle) * dist, seed++);
  }

  return envObjects;
}
