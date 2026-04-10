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
  <a href="#configuration">Configuration</a> &middot;
  <a href="#development">Development</a>
</p>

---

## Quick Start

Obscura ships as a **single Docker image** with everything included — no external databases, no multi-service setup, no configuration required.

### Docker Run

```bash
docker run -d \
  --name obscura \
  -p 8008:8008 \
  -v obscura-data:/data \
  -v /path/to/your/media:/media \
  ghcr.io/pauljoda/obscura:latest
```

### Docker Compose

```yaml
services:
  obscura:
    image: ghcr.io/pauljoda/obscura:latest
    ports:
      - "8008:8008"
    volumes:
      - obscura-data:/data
      - /path/to/your/media:/media
    restart: unless-stopped

volumes:
  obscura-data:
```

```bash
docker compose up -d
```

Open **http://localhost:8008** and you're done.

### Volumes

| Mount | Purpose |
|-------|---------|
| `/data` | Database, cache, thumbnails, HLS transcodes — everything Obscura generates |
| `/media` | Your media library. Mount one or more directories here |

That's it. No environment variables, no database credentials, no Redis URLs. The image manages PostgreSQL, Redis, and all application services internally.

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

## Configuration

Obscura works out of the box with zero configuration. For advanced use cases, the following environment variables are available:

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSCURA_CACHE_DIR` | `/data/cache` | Directory for HLS cache, thumbnails, sprites |

### Multiple Media Directories

Mount as many media directories as you need:

```bash
docker run -d \
  --name obscura \
  -p 8008:8008 \
  -v obscura-data:/data \
  -v /mnt/nas/videos:/media/videos \
  -v /mnt/nas/clips:/media/clips \
  ghcr.io/pauljoda/obscura:latest
```

Then add each as a library root in **Settings > Library**.

---

## What's Inside

The single image bundles:

| Component | Version | Role |
|-----------|---------|------|
| **Next.js** | 15 | Web frontend (React 19, Tailwind CSS 4) |
| **Fastify** | 5 | HTTP API (Drizzle ORM) |
| **BullMQ** | 5 | Background job worker |
| **PostgreSQL** | 16 | Database |
| **Redis** | 7 | Job queue |
| **ffmpeg** | latest | Video transcoding |
| **nginx** | latest | Reverse proxy |

All services run inside the container, coordinated by a single entrypoint. Port **8008** is the only exposed port — nginx routes API requests internally.

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

# Start infrastructure (PostgreSQL only — pg-boss manages the job queue in-DB)
docker compose -f infra/docker/docker-compose.yml up postgres -d

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
├── infra/docker/        Dockerfiles & compose stacks
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

### Building the Docker Image Locally

```bash
docker build -f infra/docker/unified.Dockerfile -t obscura .
docker run -p 8008:8008 -v obscura-data:/data -v /your/media:/media obscura
```

---

## License

This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to share and adapt this work for non-commercial purposes, with attribution, under the same license terms. See [LICENSE](LICENSE) for details.
