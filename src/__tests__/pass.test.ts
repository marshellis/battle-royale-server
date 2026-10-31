import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPass, identify } from "../auth/pass";

const sign = (c: object, secret: string) => { const b = Buffer.from(JSON.stringify(c)).toString("base64url"); return `${b}.${createHmac("sha256", secret).update(b).digest("base64url")}`; };
const claims = (exp: number) => ({ u: "kida", a: "🦊", c: "#fff", room: "battle-royale", exp, lb: true });
const now = 1_000_000;

describe("game pass", () => {
  it("accepts a valid pass, rejects tampered / wrong secret / expired", () => {
    const t = sign(claims(now + 60), "s");
    expect(verifyPass(t, "s", now)?.u).toBe("kida");
    expect(verifyPass(t, "x", now)).toBeNull();
    expect(verifyPass("x" + t, "s", now)).toBeNull();
    expect(verifyPass(t, "s", now + 61)).toBeNull();
    expect(verifyPass(undefined, "s", now)).toBeNull();
  });
  it("without a configured secret, behaves as before (browser-supplied name)", () => {
    expect(identify({ displayName: "Bob" }, {} as never)).toEqual({ displayName: "Bob", verified: false });
  });
  it("with a secret, the pass sets the name and ignores what the browser claims", () => {
    const t = sign(claims(now + 60), "s");
    expect(identify({ displayName: "Admin", pass: t }, { GAME_PASS_SECRET: "s" } as never, now)).toMatchObject({ displayName: "kida", verified: true, expiresAt: now + 60 });
  });
  it("with a secret and no pass: a Guest name, or refused when required", () => {
    expect(identify({ displayName: "Admin" }, { GAME_PASS_SECRET: "s" } as never)!.displayName).toMatch(/^Guest-\d{4}$/);
    expect(identify({}, { GAME_PASS_SECRET: "s", GAME_PASS_REQUIRED: "1" } as never)).toBeNull();
  });
});
