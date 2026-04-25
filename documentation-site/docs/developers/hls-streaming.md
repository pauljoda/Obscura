---
sidebar_position: 5
title: HLS Streaming
description: How videos transcode to HLS on demand, what's cached, and the direct-vs-adaptive decision.
---

# HLS Streaming

Obscura serves videos two ways: **direct** (HTTP range requests against the original file) and **HLS** (server-transcoded HTTP Live Streaming). HLS is the fallback that always works, even when the browser can't natively play the source codec or container.

This page describes the pipeline end-to-end.

## The two playback modes

| Mode | What it does | When to pick it |
| --- | --- | --- |
| **Direct** | The server streams the raw file via HTTP range requests. Browser does its own seeking and decoding. | Source format is browser-friendly (h.264/aac in mp4). Lower latency, no transcode CPU. |
| **HLS** | The server transcodes on demand into multiple bitrates (renditions) and serves them as HLS segments. Client (`hls.js`) picks bitrates adaptively. | Source format isn't natively supported, network is variable, or you want guaranteed seeking. |

Direct is the default per-instance (configurable in **Settings → Playback**). The video player's quality menu lets the user override per-video. The decision is made client-side in `apps/web-svelte/src/lib/player/video-player-load.ts`.

## The HLS routes

```text
GET /api/video-stream/[id]/hls/master.m3u8          ← master playlist (lists variants)
GET /api/video-stream/[id]/hls/[height]p.m3u8       ← variant playlist (1080p, 720p, 480p…)
GET /api/video-stream/[id]/hls/[height]p/[seg].ts   ← MPEG-TS segment
GET /api/video-stream/[id]/hls/[height]p_thumbnails.vtt  ← trickplay timing
GET /api/video-stream/[id]/hls/[height]p_thumbnails.jpg  ← sprite sheet
GET /api/video-stream/[id]/hls/status               ← encoding progress (poll)
```

All five share one handler at `apps/web-svelte/src/routes/api/video-stream/[id]/hls/[...asset]/+server.ts` which delegates to `serveLegacyHlsAsset()` in `$lib/server/video-stream`.

The direct route is separate:

```text
GET /api/video-stream/[id]/source                   ← HTTP 206 range, original bytes
```

## On-demand transcoding

Generation is lazy. The first request for `/api/video-stream/[id]/hls/master.m3u8` checks whether the cache for that video is fresh; if not, the handler enqueues a `preview` job and either streams an in-progress manifest as segments arrive or asks the client to retry shortly (depending on state).

The cache freshness check uses a sidecar `metadata.json` that records source size + mtime + the rendition list it was built for. If the source file changes, the cache is rebuilt.

The HLS builder lives at `packages/app-core/src/hls.ts:ffmpegHlsBuilder`:

```ts
// Pseudo-code of the relevant ffmpeg invocation
ffmpeg
  -i <source>
  -filter_complex "[0:v]split=N[v0][v1][v2]; [v0]scale=...[s0]; [v1]scale=...[s1]; ..."
  -map [s0] -c:v libx264 -b:v 5M -map a -c:a aac
  -map [s1] -c:v libx264 -b:v 2.5M -map a -c:a aac
  -map [s2] -c:v libx264 -b:v 1M -map a -c:a aac
  -hls_time 10 -hls_list_size 0
  -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0"
  -master_pl_name master.m3u8
  -f hls
  /data/cache/hls/{videoId}/%v.m3u8
```

Rendition presets come from `@obscura/contracts`'s `getHlsRenditions()`, which considers source resolution and bitrate to pick a sensible variant ladder.

## Cache layout

```text
/data/cache/hls/{videoId}/
├── master.m3u8
├── 1080p.m3u8
├── 1080p_0.ts
├── 1080p_1.ts
├── 1080p_2.ts
├── ...
├── 720p.m3u8
├── 720p_0.ts
├── ...
├── 1080p_thumbnails.vtt
├── 1080p_thumbnails.jpg          # trickplay sprite sheet
└── metadata.json                 # source size + mtime + rendition list
```

`metadata.json` is the authoritative state file. The handler reads it to decide whether the cache is fresh, and writes a new one when generation completes.

## Trickplay sprites

The same `preview` job that builds HLS also builds the trickplay sprite sheet — a single JPG with a grid of thumbnails sampled at fixed intervals (default every 10 seconds; configurable via `library_settings.trickplay_interval_seconds`).

The sprite sheet pairs with a WebVTT file:

```text
WEBVTT
00:00:00.000 --> 00:00:10.000
1080p_thumbnails.jpg#xywh=0,0,160,90

00:00:10.000 --> 00:00:20.000
1080p_thumbnails.jpg#xywh=160,0,160,90
...
```

`hls.js` recognises this and renders thumbnails on timeline hover.

## Direct playback

The direct route at `/api/video-stream/[id]/source` is a thin streamer that:

- Reads the file path from `video_episodes` or `video_movies`
- Honours HTTP `Range:` headers (returning HTTP 206 with `Content-Range`)
- Sets `Accept-Ranges: bytes`
- Sets the appropriate `Content-Type` from the file's container

No transcoding, no cache. The browser is doing all the work.

## Switching modes at runtime

The video player exposes a quality menu with these options:

- **Auto** — HLS adaptive (the player picks rendition based on bandwidth)
- **Direct** — switch to the direct route
- **`<height>p`** — pin to a specific HLS rendition

Switching reuses the same player element; `hls.js` is destroyed and the `<video>` source attribute is updated.

The "preferred mode" defaults to `library_settings.default_playback_mode` (`direct` or `hls`). User-mode preference per video is **not** persisted server-side — quality menu changes are session-scoped.

## When to invalidate the cache

The cache is invalidated automatically when:

- The source file's size or mtime changes (detected on the next master.m3u8 request).
- The user hits **Rebuild preview** in the video detail page.
- A library-maintenance job moves generated assets between cache and adjacent storage.

You can also manually wipe a single video's cache:

```bash
docker compose exec obscura rm -rf /data/cache/hls/<videoId>
```

The next playback request will trigger regeneration.

## Storage cost

HLS renditions are real disk usage. A 2-hour 1080p source at three renditions (1080p/720p/480p) is typically 3–6 GB of cache. With trickplay sprites, add ~10–50 MB per video. Plan for ~5–10% of your library size in cache, more if you have a lot of high-bitrate content.

You can constrain this:

- Set **Default playback mode** to `direct` so HLS is generated only on demand.
- Lower **Trickplay quality** in Settings.
- Use Settings → Generated Storage → Cleanup tools to wipe selectively.

## Why HLS at all (vs DASH, vs MSE-direct)

HLS works in every browser including Safari without extra glue, scales cleanly through any HTTP CDN/proxy, and uses commodity ffmpeg under the hood. It's not the most modern protocol, but for "private LAN, single user, ffmpeg already in the image" it's a good fit. DASH would be more powerful but doubles the toolchain; we don't need it.
