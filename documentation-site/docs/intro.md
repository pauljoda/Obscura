---
sidebar_position: 1
title: Start Here
description: What Obscura is and where to go next.
---

# Obscura documentation

Obscura is a private, self-hosted media browser for a single trusted user on a private LAN. It is video-first, but images, galleries, audio, collections, performers, studios, and tags are all first-class library entities.

The app ships as one Docker image with PostgreSQL, SvelteKit, ffmpeg, and the background worker bundled together. You mount `/data` for application state and `/media` for your library, then manage the rest from the web UI.

![Obscura dashboard](/img/screenshots/dashboard.png)

## Where to go

- **Users:** start with [Quick Start](./users/quick-start.md), then read [Library Organization](./users/library-organization.md) before scanning a large collection.
- **Developers:** start with [Architecture](./developers/architecture.md), then read the [Dark Room design language](./developers/design-language.md) before changing UI surfaces.
- **Plugin authors:** start with [Plugin Development](./developers/plugin-development.md) for manifest fields, capabilities, auth, and execution envelopes.

## Current documentation status

This site is the new home for Obscura documentation. The first pass establishes the structure, deployment, and essential starter content; deeper user and developer manuals will continue to land here as the project evolves.
