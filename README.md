# 🎵 Jam Session App

Real-time jam session management for live music events. An MC (master of ceremonies) manages musicians, builds setlists, and controls live performance blocks — all synchronized in real-time across multiple devices.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, TailwindCSS v4 |
| Backend | PartyKit (Cloudflare Workers + Durable Objects) |
| Real-time | WebSocket (PartySocket) |
| Testing | Playwright (67 E2E tests) |
| Monorepo | pnpm workspaces |

## Architecture

```
jam-session-app/
├── packages/
│   ├── web/          # React SPA (Vite)
│   │   ├── src/
│   │   │   ├── views/        # Welcome, Participant, MCDashboard, Companion
│   │   │   ├── hooks/        # usePartySocket, useSessionIdentity
│   │   │   ├── components/   # Shared UI components
│   │   │   └── data/         # Default song catalog (40 songs)
│   │   └── e2e/              # Playwright test suite
│   └── party/        # PartyKit server (Cloudflare Edge)
│       └── src/
│           ├── server.ts     # WebSocket room server
│           ├── types.ts      # Shared types (Song, Musician, JamState)
│           ├── catalog.ts    # Song catalog management
│           ├── matcher.ts    # Lineup suggestion algorithm (CSP)
│           └── persistence.ts
```

## User Roles

- **MC (Master of Ceremonies)** — Manages the event: authenticates with PIN, manages song catalog, reviews lineup suggestions, controls live timer, ends event
- **Participant (Musician)** — Registers with alias + instrument, selects preferred songs, waits in queue, proposes new songs
- **Companion (Spectator)** — Read-only view showing current song, musicians on stage, and timer

## Key Features

- **Dynamic Song Catalog** — 40 default songs (jazz/blues/funk/latin) + MC can add/edit/remove + participants can propose
- **Lineup Suggestions** — Greedy CSP algorithm matches musicians to songs based on instrument requirements and preferences
- **Block-based Setlist** — 7-minute performance blocks with Play/Pause/Reset timer controls
- **Real-time Sync** — All changes propagate instantly via WebSocket to all connected clients
- **Session Persistence** — Musician identity stored in localStorage for reconnection
- **Event Lifecycle** — Full flow from registration → queue → setlist → live performance → stats

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** (install: `npm install -g pnpm`)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start both servers (PartyKit + Vite) in parallel
pnpm dev:all

# Or start individually:
pnpm dev:party    # PartyKit server on http://localhost:1999
pnpm dev          # Vite dev server on http://localhost:3000
```

Open http://localhost:3000 in your browser.

## Testing

The project includes 67 end-to-end tests across 11 spec files covering all user flows, real-time synchronization, and edge cases.

```bash
# Run all E2E tests
pnpm test:e2e

# Run with Playwright UI
pnpm test:e2e:ui

# Run with visible browser
pnpm test:e2e:headed

# Run a specific test file
pnpm --filter web exec playwright test e2e/welcome.spec.ts
```

### Test Coverage

| Spec File | Tests | Coverage |
|-----------|-------|----------|
| `welcome.spec.ts` | 8 | Landing page, role selection, reconnect |
| `participant-registration.spec.ts` | 11 | 3-step registration flow |
| `mc-auth.spec.ts` | 6 | PIN authentication |
| `mc-catalog.spec.ts` | 11 | CRUD, filters, YouTube thumbnails |
| `mc-setlist.spec.ts` | 5 | Suggestions, block confirmation |
| `mc-live.spec.ts` | 5 | Timer controls, block lifecycle |
| `proposal-workflow.spec.ts` | 5 | Song proposals (participant → MC) |
| `companion.spec.ts` | 5 | Read-only spectator view |
| `realtime-sync.spec.ts` | 5 | Multi-browser WebSocket sync |
| `reconnect.spec.ts` | 5 | Session persistence |
| `event-lifecycle.spec.ts` | 1 | Golden path (11 steps) |

## Environment Variables

| Variable | Where | Purpose | Default |
|----------|-------|---------|---------|
| `VITE_PARTYKIT_HOST` | Frontend (build-time) | PartyKit server host | `localhost:1999` |
| `MC_PIN` | PartyKit server (runtime) | MC authentication PIN | `1234` |

## Deployment

### Deploy everything (frontend + server)

```bash
pnpm deploy
```

This builds the Vite frontend and deploys both the static assets and PartyKit server to Cloudflare's edge network.

### Manual deployment

```bash
# 1. Build frontend
VITE_PARTYKIT_HOST=your-party-host.partykit.dev pnpm --filter web build

# 2. Deploy PartyKit (serves both WebSocket server + static frontend)
pnpm --filter party deploy
```

### Setting production env vars

```bash
# Set MC PIN for production (from packages/party/)
npx partykit env add MC_PIN
```

## WebSocket Protocol

The app uses a typed WebSocket protocol with 13 client message types and 14 server message types. Key message flows:

```
Participant                    Server                    MC
    |--- register ------------->|                         |
    |                           |--- musician_joined ---->|
    |                           |                         |
    |                           |<-- request_suggestion --|
    |                           |--- full_state --------->|
    |                           |                         |
    |                           |<-- confirm_block -------|
    |<-- block_started ---------|--- block_started ------>|
    |                           |                         |
    |                           |<-- end_event -----------|
    |<-- event_ended -----------|                         |
```

## License

MIT
