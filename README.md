<p align="center">
  <img src="docs/logo.svg" width="128" height="128" alt="Obscura" />
</p>

<h1 align="center">Obscura</h1>

<p align="center">
  A private, self-hosted media browser built for a single trusted user.
  <br />
  Video-first. Image and gallery support. Designed to run on your LAN.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#configuration">Configuration</a> &middot;
  <a href="#development">Development</a>
</p>

---

## Quick Start

Pull and run with Docker Compose:

```bash
curl -O https://raw.githubusercontent.com/pauljoda/obscura/main/docker-compose.yml
docker compose up -d
```

Obscura will be available at `http://localhost:8008`.

### Docker Compose

```yaml
services:
  web:
    image: ghcr.io/pauljoda/obscura-web:latest
    ports:
      - "8008:8008"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:4000
    depends_on:
      - api
    restart: unless-stopped

  api:
    image: ghcr.io/pauljoda/obscura-api:latest
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://obscura:obscura@postgres:5432/obscura
      - REDIS_URL=redis://redis:6379
      - OBSCURA_CACHE_DIR=/data/cache
    depends_on:
      - postgres
      - redis
    volumes:
      - cache-data:/data/cache
      - media-data:/media
    restart: unless-stopped

  worker:
    image: ghcr.io/pauljoda/obscura-worker:latest
    environment:
      - DATABASE_URL=postgresql://obscura:obscura@postgres:5432/obscura
      - REDIS_URL=redis://redis:6379
      - OBSCURA_CACHE_DIR=/data/cache
    depends_on:
      - postgres
      - redis
    volumes:
      - cache-data:/data/cache
      - media-data:/media
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: obscura
      POSTGRES_USER: obscura
      POSTGRES_PASSWORD: obscura
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres-data:
  cache-data:
  media-data:
```

### Docker Images

| Image | Description |
|-------|-------------|
| `ghcr.io/pauljoda/obscura-web` | Next.js frontend |
| `ghcr.io/pauljoda/obscura-api` | Fastify HTTP API |
| `ghcr.io/pauljoda/obscura-worker` | BullMQ background worker |

### Volumes

| Volume | Purpose |
|--------|---------|
| `postgres-data` | PostgreSQL database storage |
| `cache-data` | HLS transcoded video cache, thumbnails, sprite sheets |
| `media-data` | Shared media library root |

---

## Features

### Media Library

Browse and manage your video library with a responsive grid layout. Scene cards display thumbnails, duration, resolution, and metadata at a glance. Filter by performer, studio, tag, or search by title.

### Video Playback

HLS adaptive streaming powered by ffmpeg. On-demand transcoding with cached renditions. Keyboard controls, poster frames, and a film-strip trickplay scrubber with sprite sheet previews.

### Metadata Management

Rich metadata display including performers, studios, tags, and file details. Scraper system with community scraper support for automated metadata matching. Tagger UI for reviewing and merging scraped results.

### Library Scanning

Point Obscura at a directory and it will discover, fingerprint, and catalog your media. Background workers handle probing, thumbnail generation, sprite sheet extraction, and HLS cache preparation.

### Stash Import

Migrate from an existing Stash database. Scenes, performers, studios, and tags are normalized into Obscura-owned records while preserving source provenance for auditability.

### Settings

Configure library roots, scan behavior, and application preferences through the web UI. All settings are persisted to the database and take effect immediately.

---

## Architecture

Obscura is a monorepo with three services and shared packages:

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│    Web      │────▶│    API      │────▶│   Worker    │
│  Next.js    │     │  Fastify    │     │   BullMQ    │
│  :8008      │     │  :4000      │     │             │
└────────────┘     └─────┬───────┘     └──────┬──────┘
                         │                     │
                   ┌─────┴─────┐         ┌─────┴─────┐
                   │ PostgreSQL │         │   Redis    │
                   │    :5432   │         │   :6379    │
                   └───────────┘         └───────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| API | Fastify 5, Drizzle ORM |
| Worker | BullMQ 5, ffmpeg |
| Database | PostgreSQL 16 |
| Queue | Redis 7 |
| Build | pnpm workspaces, Turborepo |
| Deploy | Docker, GitHub Actions, GHCR |

### Packages

| Package | Purpose |
|---------|---------|
| `@obscura/contracts` | Typed DTOs, route constants, job identifiers |
| `@obscura/ui` | Design tokens, shared components |
| `@obscura/media-core` | File discovery, fingerprint, scan primitives |
| `@obscura/stash-import` | Stash database migration adapter |
| `@obscura/config` | Shared TypeScript and lint configuration |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `OBSCURA_CACHE_DIR` | `/data/cache` | Directory for HLS cache, thumbnails, sprites |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API URL (used by the web frontend) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:8008` | Web app URL |
| `PORT` | Service-specific | `8008` (web), `4000` (api) |
| `HOST` | `0.0.0.0` | Bind address |

### PostgreSQL

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `obscura` | Database name |
| `POSTGRES_USER` | `obscura` | Database user |
| `POSTGRES_PASSWORD` | `obscura` | Database password |

---

## Design Language

Obscura uses a **Dark Control Room** visual system inspired by Blackmagic DaVinci Resolve, high-end audio rack gear, and film color grading suites.

- **Surface hierarchy**: Five levels from near-black graphite to elevated panel gray
- **Accent**: Burnished brass (#c79b5c) — used sparingly for active and selected states
- **Typography**: Geist (headings), Inter (body), JetBrains Mono (metadata and utility)
- **Motion**: Weighted and deliberate — precision machinery, no bounce
- **Status indicators**: Muted LED-style colors, not bright saturated alerts

Full specification in [`docs/design-language.md`](docs/design-language.md).

---

## Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker and Docker Compose (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repository
git clone https://github.com/pauljoda/obscura.git
cd obscura

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL + Redis)
docker compose -f infra/docker/docker-compose.yml up postgres redis -d

# Push database schema
pnpm --filter @obscura/api db:push

# Start all services in development mode
pnpm dev
```

The web UI will be available at `http://localhost:8008` and the API at `http://localhost:4000`.

### Project Structure

```
obscura/
├── apps/
│   ├── web/             Next.js 15 frontend
│   ├── api/             Fastify 5 API server
│   └── worker/          BullMQ background worker
├── packages/
│   ├── ui/              Design tokens & shared components
│   ├── contracts/       Typed DTOs & route constants
│   ├── config/          Shared TypeScript config
│   ├── media-core/      Media discovery & fingerprint
│   └── stash-import/    Stash migration adapter
├── infra/docker/        Dockerfiles & dev compose stack
├── scripts/release/     Version validation tooling
└── docs/                Architecture & design docs
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm check` | Run lint and typecheck across the monorepo |
| `pnpm release:check` | Validate version and changelog alignment |
| `pnpm --filter @obscura/api db:push` | Push schema changes to PostgreSQL |
| `pnpm --filter @obscura/api db:studio` | Open Drizzle Studio |

---

## License

This project is private and not licensed for redistribution.
