---
sidebar_position: 1
title: Quick Start
description: Run Obscura with Docker and open the app.
---

# Quick Start

Obscura runs as a single Docker image. The container includes PostgreSQL, ffmpeg, the SvelteKit web server, and the background worker.

## Docker run

```bash
docker run -d \
  --name obscura \
  -p 8008:8008 \
  -v obscura-data:/data \
  -v /path/to/your/media:/media \
  ghcr.io/pauljoda/obscura:latest
```

Open `http://localhost:8008`.

## Docker Compose

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

## Volumes

| Mount | Purpose |
| --- | --- |
| `/data` | Database, cache, thumbnails, trickplay sprites, HLS transcodes, and generated media. |
| `/media` | Your media library. Mount one or more host directories here. |

After boot, add library roots from Settings and run a scan from the Operations dashboard.

## Image tags

| Tag | Use it when |
| --- | --- |
| `latest` | You want the most recent stable release. |
| `X.Y.Z`, `X.Y`, `X` | You want to pin a released version or release line. |
| `dev` | You want the newest commit on `main` and accept churn. |
| `sha-abc1234` | You want one exact dev build for rollback or testing. |

Use `latest` for normal installs. Use `dev` only when you are testing a change that has not shipped in a release yet.
