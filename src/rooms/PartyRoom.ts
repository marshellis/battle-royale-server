import { Room, Client, matchMaker } from "@colyseus/core";
import { PartyState, PartyMemberState } from "../schemas/PartyState";
import { generateRoomCode } from "../game/roomCode";
import { MODE_CONFIG } from "../game/constants";
import { formTeams } from "../game/teamFormation";

export class PartyRoom extends Room<PartyState> {
  onCreate() {
    this.setState(new PartyState());
    this.state.code = generateRoomCode();
    this.setMetadata({ code: this.state.code });

    this.onMessage("select-mode", (client: Client, data: { mode: string }) => {
      if (client.sessionId !== this.state.leaderId) return;
      if (!MODE_CONFIG[data.mode]) return;
      this.state.selectedMode = data.mode;
    });

    this.onMessage("kick", (client: Client, data: { sessionId: string }) => {
      if (client.sessionId !== this.state.leaderId) return;
      const target = this.clients.find((c) => c.sessionId === data.sessionId);
      target?.leave(4000);
    });

    this.onMessage("start-match", async (client: Client) => {
      if (client.sessionId !== this.state.leaderId) return;

      const mode = this.state.selectedMode;
      const config = MODE_CONFIG[mode];
      const memberIds = Array.from(this.state.members.keys());
      const teams = formTeams(memberIds, config.teamSize, config.totalTeams);

      const roomListing = await matchMaker.createRoom("match", { mode, teams });

      for (const teamMemberClient of this.clients) {
        const reservation = await matchMaker.reserveSeatFor(roomListing, {
          displayName: this.state.members.get(teamMemberClient.sessionId)?.displayName ?? "Anonymous",
        });
        teamMemberClient.send("match-ready", reservation);
      }

      this.lock();
      this.clients.forEach((c) => c.leave(1000));
    });
  }

  onJoin(client: Client, options: { displayName?: string } = {}) {
    const member = new PartyMemberState();
    member.sessionId = client.sessionId;
    member.displayName = options.displayName ?? "Anonymous";
    this.state.members.set(client.sessionId, member);

    if (this.state.leaderId === "") {
      this.state.leaderId = client.sessionId;
    }
  }

  onLeave(client: Client) {
    this.state.members.delete(client.sessionId);
    if (this.state.leaderId === client.sessionId) {
      const next = this.clients.find((c) => c.sessionId !== client.sessionId);
      this.state.leaderId = next?.sessionId ?? "";
    }
  }
}
