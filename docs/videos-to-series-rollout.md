# Videos → Series Migration Rollout Plan

**Status:** Ready
**Last updated:** 2026-04-15
**Owner:** pauljoda
**Linear epic:** [APP-29 — Systemic scene-table cutover](https://linear.app/pauljoda/issue/APP-29)

This doc is the operator playbook for cutting the destructive phase of
the videos-to-series data migration. It exists so the flip happens
deliberately — not on improvisation — and so a rollback path is written
down before anyone needs it.

---

## 1. What's changing

The legacy `scenes` / `scene_folders` tables are replaced by a typed
`video_series` → `video_seasons` → `video_episodes` / `video_movies`
model. The reshape ships in two phases:

- **Stage** (automatic, non-destructive): On boot, `videos_to_series_model_v1.stage()`
  inserts every existing scene into the new video tables, copies subtitles,
  markers, custom folder names, scrape results, and collection items.
  The legacy tables remain. The app runs out of the new tables; the old
  ones sit as backup.
- **Finalize** (user-triggered, destructive): The user clicks
  "Finalize migration" in the in-app banner. `finalize()` drops
  `scenes`, `scene_folders`, `scene_performers`, `scene_tags`,
  `scene_markers`, `scene_subtitles`, `scene_folder_performers`,
  `scene_folder_tags`, and the now-unused `library_roots.scan_videos`
  column, all inside a single transaction. On success the
  `data_migrations.videos_to_series_model_v1` row flips to `complete`.

After finalize, the legacy-schema adapter modules
(`data-migrations/videos_to_series_model_v1/{legacy-schema,read}.ts`)
become dead code and are deleted in a follow-up commit (APP-23).

---

## 2. What "safe to finalize" means

Finalize is one-way for anyone without a backup. Do not flip it until
every bullet below is true. Track the list on APP-26.

### Code prerequisites — **all done**

- [x] APP-8: subtitles ported (`video_subtitles`, worker, routes)
- [x] APP-9: markers ported (`video_markers`, routes)
- [x] APP-10: `finalize()` is destructive and drops the legacy tables
- [x] APP-11: folder cover/backdrop upload on the new model
- [x] APP-12: `video_series.custom_name`
- [x] APP-13: `collection_items` rewrite during `stage()`
- [x] APP-14: plugin scrape-accept downloads folder cover
- [x] APP-15: performer/tag chips on `/videos` list
- [x] APP-29: every API service, worker processor, route, and search
      provider reads from the video tables

### Environment prerequisites

- [ ] APP-16: manual E2E pass of `/videos` UI on a real library
- [ ] APP-17: migration banner verified in a prod-mode build
      (not `next dev`)
- [ ] APP-18: downstream job processors smoke-tested against a
      post-stage DB (probe / fingerprint / preview / extract-subtitles
      dispatch cleanly on the new entity kind)

### Hard-stop conditions (do **not** click finalize if any are true)

- `data_migrations.videos_to_series_model_v1.status` is not `staged`
- The install has unmigrated scene rows (`stage()` had `missingFiles` > 0)
  and the operator hasn't reviewed them
- `stage()` metrics show any warning you don't recognize
- The deployment has no recent snapshot of `/data`

---

## 3. How to run finalize

Finalize is user-triggered through the in-app banner. The code path is
`POST /system/migrations/videos_to_series_model_v1/finalize`; the web
UI's "Finalize migration" button wraps it.

**Preferred flow (non-engineer):**

1. Confirm a DB snapshot exists — see §4 below.
2. Open the app.
3. Observe the amber "Migration staged — Videos → Series model" banner.
4. Click **Finalize migration**.
5. The inline confirm appears: `[Yes, finalize] [Cancel]`. Click yes.
6. On success the banner disappears and the `data_migrations` row
   flips to `complete`. No app restart is required.

**Engineer flow (via API):**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  "$OBSCURA_API/system/migrations/videos_to_series_model_v1/finalize"
```

Response on success:

```json
{ "ok": true, "status": "complete" }
```

Response on failure: HTTP 500 with `{ "error": "<message>" }` and the
`data_migrations` row flipped to `failed` with the error string in
`last_error`. The DB state is unchanged (the wrapping transaction rolls
back) so the legacy tables are still there — safe to investigate and
retry once the underlying issue is fixed.

---

## 4. Backup

**Before finalize**, take a full snapshot of the `/data` volume. This
is the only supported rollback path — there is no in-app undo.

**Compose / single-host:**

```bash
docker compose stop api worker web
docker run --rm \
  -v obscura_data:/data \
  -v "$(pwd)/backups":/backups \
  alpine:3 tar czf /backups/obscura-pre-finalize-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
docker compose start api worker web
```

**Unified image:**

```bash
docker stop obscura
docker run --rm \
  --volumes-from obscura \
  -v "$(pwd)/backups":/backups \
  alpine:3 tar czf /backups/obscura-pre-finalize-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
docker start obscura
```

Verify the archive: `tar tzf backups/obscura-pre-finalize-*.tar.gz | head`.
Confirm it contains `postgres/`, `cache/`, and the drizzle ledger.

Keep the snapshot for at least **30 days** after finalize ships to
production. Shorter windows are fine for dev and staging.

---

## 5. Rollback

Rollback restores the entire `/data` volume from the pre-finalize
snapshot. Everything written after the snapshot is lost — scans, play
tracking, scrape results, uploads. That's the trade-off for not having
an in-app undo.

```bash
docker compose down
docker volume rm obscura_data
docker volume create obscura_data
docker run --rm \
  -v obscura_data:/data \
  -v "$(pwd)/backups":/backups \
  alpine:3 sh -c 'cd /data && tar xzf /backups/obscura-pre-finalize-<timestamp>.tar.gz'
docker compose up -d
```

On startup the app sees `data_migrations.videos_to_series_model_v1.status = 'staged'`
again (that's the pre-finalize state) and the banner reappears. Scenes
and scene_folders are back. The new video tables still hold the staged
data but no code reads them exclusively — they're harmless.

**Rollback must be tested at least once against a disposable DB before
shipping destructive finalize to production.** Record the test run as
a comment on APP-26.

---

## 6. Comms & user-facing copy

The banner already has the text the user sees. Reference:

- **Staged banner body:** "Migration staged — Videos → Series model.
  New video tables are populated. Review your library, and when you're
  ready, click Finalize migration to remove the old tables."
- **Inline confirm:** `[Yes, finalize] [Cancel]`
- **Warning strip:** "Finalizing drops the legacy scenes and
  scene_folders tables. This cannot be undone without a database
  restore."

After `complete`, the banner is hidden and no further notice is shown
to the user. `/system/status` returns the same shape it did before,
just with the migration in `complete` state.

If an install fails finalize, the banner re-renders with the error
message surfaced from `data_migrations.last_error`. The retry button
reuses the same endpoint.

---

## 7. Sequencing dependencies

The destructive step only runs after everything upstream is green.

```
APP-8  (subtitles port)  ─┐
APP-9  (markers port)    ─┤
APP-11 (folder cover)    ─┤
APP-12 (customName)      ─┤
APP-13 (collection items) ─┼──► APP-29 (cutover epic) ──► APP-10 (destructive finalize)
APP-14 (plugin cover)    ─┤
APP-15 (list chips)      ─┤
APP-28 (folder upload)   ─┘
                                APP-16 ─┐
                                APP-17 ─┼──► flip the switch in prod
                                APP-18 ─┘
                                                               │
                                                               ▼
                                                        APP-23 (delete legacy adapter)
```

All of column 1 is done. APP-16 / APP-17 / APP-18 (the verification
row) are the last gate before the production flip.

---

## 8. Open risks

- **Downstream job poison pills** — pre-cutover jobs in the queue that
  still carry a `sceneId` payload will be rejected by the ported
  processors with a loud error. The Ops dashboard shows them as
  "failed" under the matching queue. Acknowledge them from the
  dashboard or `POST /jobs/acknowledge-failed` after finalize. Not a
  data-loss risk — jobs are transient. Tracked under APP-18.
- **Stale `/assets/scenes/:id/*` URLs** — image and preview URLs still
  use the `scenes` URL shape; the asset router resolves ids against
  the video tables first. Safe to leave; rename ship-on-demand.
- **External links / bookmarks** — the legacy `/scenes/:id` web route
  is gone. Any bookmarked URL returns 404. Users should use the new
  `/videos/:id` shape. No migration possible beyond a note in the
  release.

---

## 9. After finalize

1. Verify the `data_migrations` row shows `complete` and the banner is
   gone.
2. Monitor the Ops dashboard for 24h. Any processor that surfaces a
   "legacy payload" error is in-flight pre-cutover work, not a bug in
   the ported code.
3. Delete the legacy-schema adapter (APP-23) — a follow-up commit
   removes `data-migrations/videos_to_series_model_v1/legacy-schema.ts`
   and `read.ts`.
4. Eventually, remove the `@deprecated` scene table definitions from
   `packages/db/src/schema.ts` once every tracked deployment has
   finalized. Drizzle schema + live DB are then fully aligned.

---

## 10. Revision log

- 2026-04-15: First draft. Ready for production flip pending APP-16 /
  APP-17 / APP-18.
