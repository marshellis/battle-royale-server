export interface FormedTeam {
  id: number;
  memberIds: string[]; // real player sessionIds on this team, in join order
  botCount: number;    // bots needed to fill this team to teamSize
}

// One uniform rule for every case (solo, full party, oversized party): chunk the
// party's member list into groups of teamSize; a short last chunk gets bot-topped;
// every remaining team slot up to totalTeams is entirely bots.
export function formTeams(partyMemberIds: string[], teamSize: number, totalTeams: number): FormedTeam[] {
  const teams: FormedTeam[] = [];
  let teamId = 0;

  for (let i = 0; i < partyMemberIds.length; i += teamSize) {
    const chunk = partyMemberIds.slice(i, i + teamSize);
    teams.push({ id: teamId++, memberIds: chunk, botCount: teamSize - chunk.length });
  }

  while (teams.length < totalTeams) {
    teams.push({ id: teamId++, memberIds: [], botCount: teamSize });
  }

  return teams;
}
