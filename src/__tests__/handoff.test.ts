// src/__tests__/handoff.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client as ColyseusJsClient } from "colyseus.js";
import { PartyRoom } from "../rooms/PartyRoom";
import { MatchRoom } from "../rooms/MatchRoom";

const TEST_PORT = 2568; // @colyseus/testing's DEFAULT_TEST_PORT when booted with a Server instance

describe("party -> match end-to-end handoff", () => {
  let colyseus: ColyseusTestServer;

  afterEach(async () => {
    await colyseus.shutdown();
    // @colyseus/testing always binds the fixed test port (2568). Node's HTTP
    // keep-alive pool can hold a socket open to the just-closed listener for a
    // moment after shutdown() resolves; without a short grace period the next
    // test's boot() on the same port intermittently hits a stale keep-alive
    // socket and the reused connection is torn down with ECONNRESET. (Same
    // fix already applied in PartyRoom.test.ts / MatchRoom.test.ts.)
    await new Promise((r) => setTimeout(r, 100));
  });

  it("two party members starting Duos both land in the same MatchRoom on the same team", async () => {
    const server = new Server({ transport: new WebSocketTransport() });
    server.define("party", PartyRoom);
    server.define("match", MatchRoom);
    colyseus = await boot(server);

    const partyRoom = await colyseus.createRoom("party", {});
    const alice = await colyseus.connectTo(partyRoom, { displayName: "Alice" });
    const bob = await colyseus.connectTo(partyRoom, { displayName: "Bob" });

    alice.send("select-mode", { mode: "duos" });
    await new Promise((r) => setTimeout(r, 50));

    const aliceSeat = new Promise<any>((resolve) => alice.onMessage("match-ready", resolve));
    const bobSeat = new Promise<any>((resolve) => bob.onMessage("match-ready", resolve));
    alice.send("start-match");
    const [aliceReservation, bobReservation] = await Promise.all([aliceSeat, bobSeat]);

    expect(aliceReservation.room.roomId).toBe(bobReservation.room.roomId);

    const realAlice = new ColyseusJsClient(`ws://localhost:${TEST_PORT}`);
    const realBob = new ColyseusJsClient(`ws://localhost:${TEST_PORT}`);
    const aliceMatch = await realAlice.consumeSeatReservation(aliceReservation);
    const bobMatch = await realBob.consumeSeatReservation(bobReservation);
    await new Promise((r) => setTimeout(r, 100));

    const aliceState = aliceMatch.state as any;
    expect(aliceState.mode).toBe("duos");
    expect(aliceState.teams.size).toBe(50);

    const alicePlayer = aliceState.players.get(aliceReservation.sessionId);
    const bobPlayer = aliceState.players.get(bobReservation.sessionId);
    expect(alicePlayer.teamId).toBe(bobPlayer.teamId);

    await aliceMatch.leave();
    await bobMatch.leave();
  });
});
