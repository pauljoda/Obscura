---
sidebar_position: 9
title: Upgrading
description: Image tags, version policy, breaking changes, and how to roll back.
---

# Upgrading

Obscura is pre-1.0 and we don't carry compatibility shims between schema breaks. This page tells you what each image tag means, how breaking changes are announced, and how to roll back when something doesn't go your way.

## Image tags

| Tag | What it pins | Use it when |
| --- | --- | --- |
| `latest` | Most recent stable release. | Normal installs. Moves only when the Release workflow runs. |
| `X.Y.Z` (e.g. `0.20.1`) | One exact release. | Pin a known-good version. |
| `X.Y` (e.g. `0.20`) | Latest patch on a minor line. | Track bug fixes only. |
| `X` (e.g. `0`) | Latest minor on a major line. | Long-running deployment with the broadest tracking band. |
| `dev` | Newest commit on `main`. | Testing a change that hasn't been released. Accept churn. |
| `sha-abc1234` | One exact dev build. | Rollback or pinned dev testing. |
| `X.Y.Z-abc1234` | Dev build labelled with the in-flight version marker. | Same as `sha-`, with the next-version cue baked in. |

`latest` always resolves to the most recent released version. `dev` is rebuilt on every push to `main` (excluding the release workflow's own commits). For the bleeding edge with rollback safety, pin to a specific `sha-…` tag and bump it deliberately.

## Versioning policy

Obscura follows [Semantic Versioning](https://semver.org/):

| Bump | What it means |
| --- | --- |
| **MAJOR** (`1.0.0`) | Breaking API changes, schema changes that need manual migration, config-format changes. |
| **MINOR** (`0.21.0`) | New features, new API endpoints, new UI views. |
| **PATCH** (`0.20.1`) | Bug fixes, UI tweaks, dependency updates, docs. |

Between releases, `package.json` carries a pre-release marker — `0.21.0-dev` means "the next release will be at least 0.21.0." This is what dev builds are tagged from.

## Where to find the changelog

The release notes are in [`CHANGELOG.md`](https://github.com/pauljoda/Obscura/blob/main/CHANGELOG.md) and in the [GitHub Releases](https://github.com/pauljoda/Obscura/releases) page. Every release section starts with a **What's New** block written for users — read that before upgrading.

## Routine upgrades

The happy path:

```bash
docker compose pull && docker compose up -d
```

Migrations apply on boot. The web UI and worker share the same migration runner; whichever process starts first runs the migrations and the other waits.

If a migration fails, the container exits — Obscura would rather refuse to start than serve a half-migrated database. The error appears in `docker compose logs obscura`.

## Breaking upgrades

When a release would destroy data or require a rescan, the release notes call that out under **What's New** and the Keep a Changelog sections. Read those notes before upgrading, especially while Obscura is pre-1.0.

For breaking upgrades:

1. Snapshot `/data` before pulling the new image.
2. Read `CHANGELOG.md` for any rescan or manual-action instructions.
3. Start the new image and let EF Core migrations run on boot.
4. If the release notes say to rebuild metadata, run a fresh scan from Operations -> Library scan -> Run.

:::caution
If you upgrade and decide later you wanted the old state, the only way back is restoring `/data` from a snapshot taken before the upgrade. Take the snapshot first.
:::

## Rolling back

If a release is broken on your setup:

1. **Stop the container.**
   ```bash
   docker compose down
   ```
2. **Restore `/data`** from the snapshot you took before the upgrade (you took one, right?).
3. **Pin the previous version.**
   ```yaml
   image: ghcr.io/pauljoda/obscura:0.20.0   # or whatever the previous version was
   ```
4. **Bring it back up.**
   ```bash
   docker compose up -d
   ```

Without a `/data` snapshot, rollback after a forward-only migration isn't possible. Snapshot before any upgrade you can't easily redo.

## Backups

Obscura ships no built-in backup tool. The strategies that work:

- **Volume snapshot** (ZFS, btrfs, LVM) of `/data`. Cheap, instant, the safest option for downgrade.
- **`pg_dump` of the embedded Postgres** (more involved; you have to `docker exec` into the running container). Useful if you want a portable SQL dump independent of disk-format.
- **Just back up `/data`** with `rsync` or `restic`. Stop the container first to get a consistent snapshot — Postgres files are not safe to copy while it's running.

Your **media** (`/media`) doesn't need a backup from Obscura's perspective — it's read-only as far as Obscura is concerned and lives wherever you keep your files.

## Dev image discipline

The `dev` tag exists for testing in-flight work. It is rebuilt on every push to `main` and may include schema changes that haven't shipped to a release. Two things to know:

1. A `dev` build can advance the schema. If you go back to a release tag afterwards, the schema may be ahead of what that release knows how to talk to. **Treat going back to release as a downgrade** — restore a `/data` snapshot.
2. The release workflow skips its own commits when picking dev builds (commits whose message starts with `chore(release):`), so you won't get a dev build of the release commit.

In short: `dev` is fine for testing, not great for "I'll just leave this running and see how it goes."
