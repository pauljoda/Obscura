---
sidebar_position: 1
title: Start Here
description: What Obscura is and where to go next.
---

# Welcome to Obscura

Obscura is a **private, self-hosted media browser** for a single trusted user on a private LAN. It is video-first, but images, galleries, audio, collections, performers, studios, and tags are all first-class library entities.

The app ships as a **single Docker image** with PostgreSQL, ffmpeg, the SvelteKit web server, and the background worker bundled together. You mount `/data` for application state and `/media` for your library, then drive everything from the web UI on port `8008`.

![Obscura dashboard](/img/screenshots/dashboard.png)

## What Obscura does

| Capability | What it gets you |
| --- | --- |
| **HLS streaming** | Videos transcode on demand via ffmpeg, with cached renditions and trickplay sprites. |
| **Universal Identify** | One identify engine across videos, series, galleries, images, audio libraries, audio tracks. |
| **Plugin-powered metadata** | Native TypeScript and Python plugins, plus Stash-compatible YAML scrapers and StashBox endpoints. |
| **Cinematic UI** | Dark Room visual system: sharp edges, brass accent, glass surfaces, mobile-first. |
| **Real operations** | A live job dashboard backed by pg-boss and a `job_runs` ledger you can inspect. |
| **One container** | PostgreSQL 16, ffmpeg, audiowaveform, the perceptual-hash binary — all baked in. |

## Pick a track

There are three ways into these docs depending on what you're doing today.

### I want to run Obscura

Start at [Quick Start](./users/quick-start.md). Then read [First Boot](./users/first-boot.md) before pointing it at a real library. Scanning, identify, settings, and operations follow from there.

### I want to understand the code

Start at [Architecture](./developers/architecture.md). [Monorepo Layout](./developers/monorepo.md), [Database](./developers/database.md), [API & Jobs](./developers/api-and-jobs.md), and [HLS Streaming](./developers/hls-streaming.md) drill into each layer. [Contributing](./developers/contributing.md) covers commit, changelog, and release flow.

### I want to write a plugin

Start at [Plugins · Overview](./plugins/overview.md). [Manifest](./plugins/manifest.md) and [Capabilities](./plugins/capabilities.md) are the reference; [TypeScript](./plugins/typescript-plugin.md) and [Python](./plugins/python-plugin.md) walk through real plugins end-to-end.

## Conventions used in these docs

- **Code blocks** are copy-paste ready — paths use `/data` and `/media` as defaults, swap in yours.
- **File references** use `path/to/file.ts` so you can open them in your editor; line refs look like `file.ts:42`.
- **Admonitions** (info / tip / warning) flag things that are easy to miss or get wrong.
- **Screenshots** show the live app — your build may differ slightly as features land.

:::tip
Obscura is pre-1.0. We do not maintain backwards-compatibility shims between schema breaks. When something destructive changes, you'll see a one-time gate in the UI explaining what happens and asking for consent. The [Upgrading](./users/upgrading.md) page covers the policy.
:::
