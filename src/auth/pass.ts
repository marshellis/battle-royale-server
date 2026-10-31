// Marshellis game pass: verify the signed pass the site issues (POST /api/family/pass).
// Offline check with the shared secret GAME_PASS_SECRET. Spec: docs in marshellis/game-generator docs/game-pass.md
import { createHmac, timingSafeEqual } from "node:crypto";

export interface PassClaims { u: string; a: string; c: string; room: string; exp: number; lb: boolean }

export function verifyPass(token: unknown, secret: string | undefined, nowSec = Math.floor(Date.now() / 1000)): PassClaims | null {
  if (typeof token !== "string" || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as PassClaims;
    return c.exp > nowSec ? c : null;
  } catch { return null; }
}

/**
 * Decide who a joining client is.
 *  - No GAME_PASS_SECRET configured: today's behaviour (browser-supplied name), so deploying this is safe.
 *  - Secret configured + valid pass: the pass's nickname (the browser cannot choose it) and its expiry.
 *  - Secret configured, no/invalid pass: a guest, "Guest-1234" (set GAME_PASS_REQUIRED=1 to refuse instead).
 */
export interface Identity { displayName: string; expiresAt?: number; verified: boolean }
export function identify(options: { displayName?: string; pass?: unknown } | undefined, env: NodeJS.ProcessEnv = process.env, nowSec?: number): Identity | null {
  const secret = env.GAME_PASS_SECRET;
  if (!secret) return { displayName: options?.displayName ?? "Anonymous", verified: false };
  const claims = verifyPass(options?.pass, secret, nowSec);
  if (claims) return { displayName: claims.u, expiresAt: claims.exp, verified: true };
  if (env.GAME_PASS_REQUIRED === "1") return null;
  return { displayName: `Guest-${Math.floor(1000 + Math.random() * 9000)}`, verified: false };
}
