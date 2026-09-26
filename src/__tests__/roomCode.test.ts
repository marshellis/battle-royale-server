import { describe, it, expect } from "vitest";
import { generateRoomCode } from "../game/roomCode";

describe("generateRoomCode", () => {
  it("returns 6 characters from the unambiguous alphabet", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("generates unique codes across many calls", () => {
    const codes = new Set(Array.from({ length: 200 }, generateRoomCode));
    expect(codes.size).toBeGreaterThan(195);
  });
});
