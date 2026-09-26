import { describe, it, expect, afterEach } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { PartyRoom } from "../rooms/PartyRoom";

describe("PartyRoom", () => {
  let colyseus: ColyseusTestServer;

  afterEach(async () => {
    await colyseus.shutdown();
    // @colyseus/testing always binds the fixed test port (2568). Node's HTTP
    // keep-alive pool can hold a socket open to the just-closed listener for a
    // moment after shutdown() resolves; without a short grace period the next
    // test's boot() on the same port intermittently hits a stale keep-alive
    // socket and the reused connection is torn down with ECONNRESET.
    await new Promise((r) => setTimeout(r, 100));
  });

  async function setup() {
    const server = new Server({ transport: new WebSocketTransport() });
    server.define("party", PartyRoom);
    colyseus = await boot(server);
    return colyseus.createRoom("party", {});
  }

  it("generates a 6-character room code on creation", async () => {
    const room = await setup();
    expect(room.state.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("makes the first joiner the leader and tracks members by display name", async () => {
    const room = await setup();
    const client1 = await colyseus.connectTo(room, { displayName: "Alice" });
    expect(room.state.leaderId).toBe(client1.sessionId);
    expect(room.state.members.get(client1.sessionId)?.displayName).toBe("Alice");

    const client2 = await colyseus.connectTo(room, { displayName: "Bob" });
    expect(room.state.members.size).toBe(2);
    expect(room.state.leaderId).toBe(client1.sessionId); // unchanged — first joiner stays leader
    await client1.leave(); await client2.leave();
  });

  it("promotes the next member to leader when the leader leaves", async () => {
    const room = await setup();
    const client1 = await colyseus.connectTo(room, { displayName: "Alice" });
    const client2 = await colyseus.connectTo(room, { displayName: "Bob" });
    await client1.leave();
    await new Promise((r) => setTimeout(r, 100));
    expect(room.state.leaderId).toBe(client2.sessionId);
    await client2.leave();
  });

  it("only lets the leader change the selected mode", async () => {
    const room = await setup();
    const leader = await colyseus.connectTo(room, { displayName: "Alice" });
    const other = await colyseus.connectTo(room, { displayName: "Bob" });

    other.send("select-mode", { mode: "squads" });
    await new Promise((r) => setTimeout(r, 50));
    expect(room.state.selectedMode).toBe("duos"); // unchanged, rejected

    leader.send("select-mode", { mode: "squads" });
    await new Promise((r) => setTimeout(r, 50));
    expect(room.state.selectedMode).toBe("squads");
    await leader.leave(); await other.leave();
  });
});
