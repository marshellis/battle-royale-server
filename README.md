# battle-royale-server

Colyseus server for Battle Royale's party multiplayer (Duos/Trios/Squads). Two room
types: `party` (lobby — invite code, member list, mode select) and `match` (the actual
game — bot-filled teams, knock/revive, storm, elimination). See
`fortnite-again/docs/2026-09-19-party-multiplayer-design.md` for the full design and
`docs/plans/2026-09-26-party-multiplayer.md` for how this was built.

## Develop

    npm install
    npm test        # vitest — all game logic is unit/integration tested without a real client
    npm run dev      # starts the server on :2567

## Deploy

Hosted on **Fly.io**. Every push to `main` runs tests, then deploys via GitHub Actions
(`.github/workflows/deploy.yml`) if they pass.

First-time setup (once, manual — cannot be automated from an agent session without your
Fly.io credentials):

1. `flyctl auth login`
2. From this directory: `flyctl launch --no-deploy --copy-config` (creates the
   `battle-royale-server` app from `fly.toml` without deploying yet)
3. `flyctl secrets set` isn't needed — this server has no secrets of its own
4. Generate a deploy token: `flyctl tokens create deploy -x 999999h` and add it as a
   GitHub Actions repository secret named `FLY_API_TOKEN`
   (repo Settings → Secrets and variables → Actions → New repository secret)
5. Push to `main` (or run the workflow manually) to trigger the first real deploy
6. Confirm it's up: `curl https://battle-royale-server.fly.dev/health` → `{"ok":true}`

The client (`fortnite-again/index.html`) needs this server's `wss://` URL — see Task C1
for where that's configured.
