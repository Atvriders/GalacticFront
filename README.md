# GalacticFront.io

A space-themed massively multiplayer real-time strategy game. Conquer star systems across the Milky Way, build empires spanning galaxies, and wage war at galactic scale.

Populations reach trillions. Credits flow in quadrillions. The galaxy is yours to claim.

## Features

- **Real Astronomy** — 200+ real star systems (Sol, Alpha Centauri, Sirius, Betelgeuse...) positioned in a stylized Milky Way
- **Planet-Level Granularity** — Each planet is a capturable tile within star systems connected by hyperlanes
- **Massive Scale** — Numbers grow from thousands to quintillions (K, M, B, T, Qa, Qi)
- **Multiplayer** — Master-worker server architecture, WebSocket relay, lobby system, ranked 1v1 with Elo
- **Singleplayer** — Full game vs AI opponents with 4 difficulty levels
- **11 AI Factions** — 6 alien species + 5 human factions, each with unique personalities and behavior modules
- **Superweapons** — Nova Bombs (scorch planets), Stellar Collapse Devices (destroy permanently), Swarm Bombardments (350 warheads)
- **Diplomacy** — Alliances, embargoes, resource transfers, quick chat with 62 space-themed phrases
- **Dark Cinematic Visuals** — Deep space backgrounds, glowing nebulae, spectral-type star colors, plasma explosions
- **Cosmetics Store** — Territory patterns, empire flags, color palettes with soft/hard currency
- **Full Infrastructure** — Docker deployment, nginx reverse proxy, JWT auth, rate limiting, OpenTelemetry observability

## Architecture

```
Browser Client ←→ WebSocket ←→ Node.js Server (relay) ←→ Shared Core Engine (Web Worker)
```

- **Client** (`src/client/`): Rendering (Canvas 2D + PIXI.js), Lit components, D3 radial menus, Howler.js audio
- **Core** (`src/core/`): Deterministic game engine — lockstep simulation, seeded PseudoRandom, command pattern executions
- **Server** (`src/server/`): Master-worker cluster, WebSocket relay, JWT auth, lobby orchestration

The server never runs simulation — it relays turns. All clients execute identical simulation in Web Workers. Hash verification every 10 ticks detects desyncs.

## Game Mechanics

### Structures
| Structure | Purpose |
|---|---|
| Colony | Population growth + troop generation |
| Starport | Spawns Freighters, enables fleet construction |
| Orbital Forge | Industrial production, connects to Hyperloop Network |
| Planetary Shield | 5x defense multiplier, fires Railgun Shells |
| Superweapon Facility | Launches Nova Bombs and Stellar Collapse Devices |
| Interceptor Array | Shoots down incoming superweapons |
| Wormhole Generator | Creates long-range wormhole connections |
| Hyperloop Station | Fast resource transit between stations |

### Units
| Unit | Role |
|---|---|
| Freighter | Autonomous trade along hyperlane routes |
| Invasion Fleet | Carries troops through wormholes |
| Battle Cruiser | Patrols hyperlanes, hunts enemies |
| Nova Bomb | Scorches a planet (recoverable) |
| Stellar Collapse Device | Destroys a planet permanently |
| Swarm Bombardment | 350 warheads, uninterceptable |

### AI Empires

**Alien Species:** Zyr'kathi Hive (aggressive swarm), Crystalline Concord (defensive turtle), Vortani Dominion (naval superiority), Synth Collective (balanced optimizer), Pyrathi Warclans (berserker), Aetheri Nomads (raider)

**Human Factions:** Solar Federation (diplomatic), Martian Collective (industrial), Outer Rim Alliance (defensive), Centauri Republic (military), Europa Technocracy (tech-heavy)

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.x |
| Build | Vite 7.x |
| UI | Lit 3.x + Tailwind CSS |
| Rendering | Canvas 2D + PIXI.js |
| Audio | Howler.js |
| Schemas | Zod |
| Server | Express + ws (WebSocket) |
| Auth | JWT (EdDSA via jose) |
| Map Generator | Go 1.22 |
| Deploy | Docker + nginx + supervisor |
| Testing | Vitest (824 tests) |

## Quick Start

### Docker (recommended)

```bash
# Run with Docker Compose (pulls pre-built image from GitHub Container Registry)
docker compose up

# Or pull and run directly
docker pull ghcr.io/atvriders/galacticfront:master
docker run -p 80:80 ghcr.io/atvriders/galacticfront:master
```

The Docker image is automatically built and pushed to `ghcr.io/atvriders/galacticfront` by GitHub Actions on every push to master. It includes nginx, the Node.js server (4 workers), and the built client — ready to play on port 80.

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start dev server (client + server)
npm run start:dev

# Build for production
npm run build

# Generate star maps
cd map-generator && go run . --maps sector,arm,galaxy
```

## Project Structure

```
src/
├── client/           # Browser UI, rendering, input
│   ├── graphics/     # GameRenderer, 14 layers, sprites, FX
│   ├── components/   # Lit web components (18 components)
│   └── sound/        # SoundManager + Howler.js
├── core/             # Shared deterministic engine
│   ├── game/         # GameImpl, PlayerImpl, UnitImpl, GameMap
│   ├── execution/    # 20+ execution types + AI behaviors
│   ├── pathfinding/  # A*, BFS, UnionFind, HyperlanePathfinder
│   └── worker/       # Web Worker integration
└── server/           # Node.js WebSocket relay
    └── 16 server modules (Master, Worker, GameServer, etc.)

map-generator/        # Go CLI (12 files, 200 real stars)
tests/                # 56 test files, 824 tests
```

## Stats

- **126 TypeScript source files** (14,597 lines)
- **56 test files** (9,338 lines, 824 tests)
- **12 Go source files** (map generator)
- **0 TypeScript errors**
- **824/824 tests passing**

## License

AGPL-3.0
