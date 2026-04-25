---
sidebar_position: 4
title: API & Jobs
description: HTTP route conventions, the queue contract, the job_runs ledger, and how request work hands off to background work.
---

# API & Jobs

The web app and worker share two contracts: HTTP routes for synchronous work and pg-boss queues for asynchronous work. Both flow through `@obscura/contracts` so the wire format is typed end-to-end.

## HTTP API

### Route layout

API routes live under `apps/web-svelte/src/routes/api/` as SvelteKit `+server.ts` files. They follow the same nesting as the URL — `/api/videos/[id]/subtitles/[trackId]/source` is a `+server.ts` at `routes/api/videos/[id]/subtitles/[trackId]/source/+server.ts`.

A representative slice of the surface:

| Family | Examples |
| --- | --- |
| **Streaming** | `GET /api/video-stream/[id]/source` (HTTP 206 ranges), `GET /api/video-stream/[id]/hls/master.m3u8`, `/hls/[height]p.m3u8`, `/hls/[height]p/[seg].ts` |
| **Audio streaming** | `GET /api/audio-stream/[id]`, `POST /api/audio-tracks/[id]/play` |
| **Thumbnails / sprites** | `GET /api/videos/[id]/thumbnail`, `/from-frame/`, `/from-url/`, `GET /api/images/[id]/thumbnail`, `GET /api/collections/[id]/cover` |
| **Subtitles** | `GET /api/videos/[id]/subtitles/[trackId]/source` (WebVTT), `/cues` (JSON) |
| **Markers** | `GET/POST/PATCH/DELETE /api/videos/[id]/markers` |
| **Uploads** | `POST /api/videos/upload`, `POST /api/galleries/[id]/images/upload`, `POST /api/audio-libraries/[id]/tracks/upload` |
| **Jobs** | `GET /api/jobs`, `POST /api/jobs/[jobRunId]/cancel`, `POST /api/jobs/queues/[queueName]/run`, `POST /api/jobs/phash-backfill`, `POST /api/jobs/rebuild-preview/[id]` |
| **Identify / scrape** | `POST /api/plugins/[id]/execute`, `POST /api/scrapers/[id]/scrape`, `POST /api/stashbox-endpoints/[id]/identify`, `POST /api/stashbox-endpoints/[id]/lookup/performer`, `POST /api/stashbox-endpoints/[id]/submit-fingerprints` |
| **Plugin management** | `GET/POST/DELETE /api/plugins/packages`, `PUT /api/plugins/packages/[id]/auth/[authKey]` |
| **Mutations** | `PATCH /api/videos/[id]`, `POST /api/performers/[id]/apply-scrape`, `POST /api/video/movies/[id]/accept-scrape`, `POST /api/video/episodes/[id]/accept-scrape`, `POST /api/video/series/[id]/accept-scrape` |
| **System** | `GET /api/system/status` (boot state + breaking-gate), `POST /api/system/breaking-gate/accept` |
| **UI prefs** | `GET/PUT/DELETE /api/ui-prefs/[key]` |
| **Misc** | `GET /api/changelog`, `GET /api/client-info` |

### Response envelope

Most JSON endpoints follow this shape:

```ts
// Success
{ ok: true, data: T }

// Paginated success
{ ok: true, data: { items: T[], total: number, page: number, perPage: number } }

// Error
{ ok: false, error: { message: string, code?: string } }
```

Streaming endpoints don't follow this shape — they write bytes directly with appropriate `Content-Type` and HTTP status.

### Error handling

Server-side errors map through a small set of classes in `packages/app-core/src/errors.ts`:

| Class | Maps to | When |
| --- | --- | --- |
| `NotFoundError` | 404 | Lookup by ID returned no row. |
| `ValidationError` | 400 | Request body or params failed validation. |
| `ConflictError` | 409 | Unique-constraint or state collision. |
| `InternalError` | 500 | Unexpected. |

Handlers `try { … } catch (err)` and convert by the `err.code`/instanceof check.

### Authentication

There isn't any. Obscura is single-user, on a private LAN, behind your own firewall. There's no session cookie, no token, no API key for the web UI itself. The plugin auth credentials and the StashBox API keys are stored encrypted in DB — those are upstream credentials, not Obscura's.

If you put Obscura behind a reverse proxy with HTTP basic auth or oauth2-proxy, the app doesn't care. Just don't expose port 8008 to the public internet directly.

### File uploads

Uploads use multipart/form-data:

```ts
// /api/videos/upload — POST, multipart
//  field "file" : the binary
//  field "libraryRootId" : where to file it
```

The handler writes the file to disk under the chosen library root and enqueues `media-probe` + `fingerprint` + `preview` jobs. The user sees the new entity once the probe job finishes.

## Job queues

pg-boss is the queue. Queue definitions live in `packages/contracts/src/index.ts`:

```ts
export const queueDefinitions = [
  { name: 'library-scan',         label: '...', concurrency: 1 },
  { name: 'media-probe',          label: '...', concurrency: 1 },
  { name: 'fingerprint',          label: '...', concurrency: 1 },
  { name: 'preview',              label: '...', concurrency: 1 },
  { name: 'metadata-import',      label: '...', concurrency: 1 },
  { name: 'gallery-scan',         label: '...', concurrency: 1 },
  { name: 'image-thumbnail',      label: '...', concurrency: 1 },
  { name: 'image-fingerprint',    label: '...', concurrency: 1 },
  { name: 'audio-scan',           label: '...', concurrency: 1 },
  { name: 'audio-probe',          label: '...', concurrency: 1 },
  { name: 'audio-fingerprint',    label: '...', concurrency: 1 },
  { name: 'audio-waveform',       label: '...', concurrency: 1 },
  { name: 'library-maintenance',  label: '...', concurrency: 1 },
  { name: 'extract-subtitles',    label: '...', concurrency: 1 },
  { name: 'collection-refresh',   label: '...', concurrency: 1 },
];
```

Each queue has one **processor** in `apps/worker/src/processors/`. The worker's `runtime.ts` registers them at boot.

| Queue | Processor | What it does |
| --- | --- | --- |
| `library-scan` | `processLibraryScan` | Walk a library root, classify files, write `video_*` rows, enqueue downstream pipeline jobs. |
| `media-probe` | `processMediaProbe` | Run ffprobe, extract metadata, write to the video row. |
| `fingerprint` | `processFingerprint` | Compute MD5 + oshash for a video. Optionally pHash if enabled. |
| `preview` | `processPreview` | Build the auto-preview clip, trickplay sprite sheet, and HLS master + variant playlists on demand. |
| `metadata-import` | `processMetadataImport` | Apply an accepted scrape result to the entity (creates performers/tags/studios, downloads images, writes fields). |
| `gallery-scan` | `processGalleryScan` | Discover image folders + zip galleries. |
| `image-thumbnail` | `processImageThumbnail` | Build an image thumbnail via `sharp`. |
| `image-fingerprint` | `processImageFingerprint` | Compute MD5 + oshash for an image. |
| `audio-scan` | `processAudioScan` | Walk audio roots, write `audio_libraries` + `audio_tracks` rows. |
| `audio-probe` | `processAudioProbe` | Extract bitrate, codec, channels, ID3 tags. |
| `audio-fingerprint` | `processAudioFingerprint` | MD5 + oshash. |
| `audio-waveform` | `processAudioWaveform` | Generate waveform peaks via `audiowaveform`. |
| `library-maintenance` | `processLibraryMaintenance` | Move generated assets between cache and adjacent storage. |
| `extract-subtitles` | `processExtractSubtitles` | Pull embedded subtitle tracks out as WebVTT. |
| `collection-refresh` | `processCollectionRefresh` | Re-evaluate a dynamic collection's rule tree. |

### Enqueueing

Don't insert into pg-boss directly. Use `enqueueJob` from `@obscura/app-core`:

```ts
import { enqueueJob } from '@obscura/app-core';

await enqueueJob(db, 'fingerprint', { videoEpisodeId: id }, {
  targetType: 'video_episode',
  targetId: id,
  targetLabel: episode.title ?? episode.filePath,
});
```

`enqueueJob` does two things atomically:

1. Inserts into pg-boss (`pgboss.send` under the hood).
2. Inserts a paired row into `job_runs` so the Operations dashboard sees it immediately.

`targetType` / `targetId` / `targetLabel` populate the dashboard's drill-down — the user sees "Generate preview · Some Movie (1995)" instead of an opaque queue name.

### The processor wrapper

Worker processors are wrapped by `runtime.ts`:

```ts
async function wrap(processor, payload) {
  await markJobStarted(jobRunId);
  try {
    const result = await processor(payload);
    await markJobCompleted(jobRunId, result);
  } catch (err) {
    await markJobFailed(jobRunId, err);
    throw err;        // let pg-boss handle retry
  }
}
```

So your processor focuses on the work; the wrapper handles `job_runs` state and pg-boss retry semantics.

### Concurrency & retries

Each queue has a per-queue concurrency multiplied by the global `library_settings.background_worker_concurrency` (default 1, range 1–16). pg-boss retries with exponential backoff up to ~15 attempts before marking a job permanently failed.

Cancelled jobs land in `job_runs` with status `cancelled`. Retries preserve the same `job_runs` row but increment `attempts`.

### Adding a new queue

1. Add the queue definition to `packages/contracts/src/index.ts`.
2. Write a processor in `apps/worker/src/processors/`.
3. Register it in `apps/worker/src/runtime.ts` (the registration loop iterates over the contracts list, so usually you just add to the registry map).
4. Add an `enqueueJob('your-queue', payload, ...)` call wherever the trigger lives.
5. The Operations dashboard picks the queue up automatically (it reads `queueDefinitions`).

## Configuration

Both the web app and the worker read the same env:

| Var | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | PostgreSQL connection string. |
| `PORT` | `8008` | Web HTTP port. |
| `HOST` | `0.0.0.0` | Web bind address. |
| `OBSCURA_DATA_DIR` | `/data` (else `~/.obscura`) | Root for cache, breaking-gate, and other state. |
| `OBSCURA_CACHE_DIR` | `${OBSCURA_DATA_DIR}/cache` | Override for cache only. |
| `OBSCURA_PHASH_BIN` | `obscura-phash` | Path to the perceptual-hash binary. |
| `OBSCURA_SECRET` | random | Encryption key for `plugin_auth.encrypted_value`. Set it in production so credentials survive restarts. |
| `CHANGELOG_PATH` | `/app/CHANGELOG.md` | Backs `/api/changelog`. |
| `PUBLIC_API_URL` | `/api` | Client-side API base URL. |
| `PUBLIC_APP_URL` | derived | Public URL for deep-links in emails / shares (none of which Obscura sends — but reserved). |

`OBSCURA_DATA_DIR` and `OBSCURA_CACHE_DIR` are resolved by `packages/media-core/src/index.ts:getCacheRootDir()`. The unified Docker image sets sensible defaults so you usually only need `DATABASE_URL` (which the bundled Postgres satisfies) and your library mount.

## Testing

Three layers, three configs:

| Kind | Config | Pattern | DB |
| --- | --- | --- | --- |
| **Unit** | `vitest.config.ts` | `*.test.ts` | None — pure functions. |
| **Integration** | `vitest.integration.config.ts` | `*.integration.test.ts` | Real Postgres via `@testcontainers/postgresql`. |
| **E2E** | `playwright.config.ts` | `e2e/*.test.ts` | Full stack against the running app. |

The integration runner spins up a fresh Postgres container per test file (slow but isolated). E2E runs against `OBSCURA_E2E_WEB_URL` (default `http://127.0.0.1:8008`).

```bash
pnpm test:unit          # fast, no DB
pnpm test:integration   # slow, real DB
pnpm test:web-svelte    # Svelte component tests
pnpm test:e2e           # Playwright
pnpm test:ci            # everything but e2e
```
