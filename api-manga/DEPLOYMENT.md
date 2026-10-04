# DEPLOYMENT — written by openpouch 🦘

Machine-readable source of truth: `deploy.evidence.json`. Do not edit by hand.

## Currently live

| Environment | Status | URL | Commit | Deployed at | Expires | Approved by | Rollback anchor |
|---|---|---|---|---|---|---|---|
| preview | live | https://komikcast-scrapping-qmqo5z.openpouch.sh | 6cbc45dbcc | 2026-10-04T13:19:48.809Z | 2026-10-07T13:19:23.658Z | — | — |

## Deploy details (latest per environment)

### preview

- CLI: openpouch 0.4.0
- Kind: dynamic · Framework: node
- Start: `node src/server.js`
- Health at deploy: healthy
- Expires: 2026-10-07T13:19:23.658Z

## History (newest first)

- 2026-10-04T13:19:48.809Z · **preview** · live · 6cbc45dbcc
- 2026-10-04T12:52:14.170Z · **preview** · live · 75bf171837 | smoke: passed (2 checks)

## Resume after context loss

An agent returning to this project re-establishes state with:

- `npx -y openpouch inspect --json` — current deployment status (environment, URL, provider)
- `npx -y openpouch verify --json --health-path /health` — health-check the live URL (GET / AND GET /health; omitting the flag also works — the manifest healthcheck is applied automatically)
- `npx -y openpouch logs --json` — recent install/build/app output (shows why a deploy is unhealthy)

If this was an instant preview, the private claim link (a save token — treat it like a password) is saved to `.openpouch/claim.json` (mode 0600, gitignored) — never in this file.

## If the app is unhealthy (self-repair)

1. `npx -y openpouch logs --limit 200 --json` — find the failing phase (lines are tagged `[install]` / `[build]` / `[app]`).
2. Fix the source or config the logs point at.
3. Redeploy — instant lane: rerun the same deploy command you used first (`npx -y openpouch deploy [dir] --json`; each redeploy gets a NEW preview URL); governed lane: `npx -y openpouch preview`.
4. `npx -y openpouch verify --json --health-path /health` — proves `/` AND the API path, not just the shell.
5. Repeat until it passes. Never share a URL that isn't healthy.
