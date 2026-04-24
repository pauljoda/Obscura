---
sidebar_position: 4
title: pHash Contribution
description: How Obscura generates and contributes perceptual hashes.
---

# pHash Contribution

Obscura can identify videos against StashDB, ThePornDB, and other StashBox-protocol servers using MD5, OpenSubtitles hash, and perceptual hash values.

The pHash implementation intentionally matches Stash's video pHash pipeline. Compatibility matters more than cleanup here: changing frame selection, seek order, scale width, montage shape, or hash formatting can produce values that no longer cluster with the community index.

## Generation summary

1. Sample 25 frames from 5 percent through 91.4 percent of the duration.
2. Use ffmpeg input seek (`-ss` before `-i`) and scale frames to width `160`.
3. Paste frames into a 5 by 5 montage while preserving source aspect ratio.
4. Run `goimagehash.PerceptionHash`.
5. Store the lowercase 16-character hex string.

The helper binary is built from `infra/phash/main.go` and copied into the Docker image as `/usr/local/bin/obscura-phash`.

## Contribution flow

```text
Identify -> Accept -> Auto-link -> Submit fingerprint
```

Accepting a StashBox-origin match inserts the remote scene link. Submitting fingerprints sends each available algorithm for that linked scene and records the attempt in `fingerprint_submissions`.

## Troubleshooting

If pHash generation is unavailable on a development machine, Obscura logs a warning and skips the hash gracefully. Use the unified Docker image, or build the helper locally:

```bash
cd infra/phash
go mod tidy
go build -o obscura-phash .
```

Then put the binary on `PATH` or point `OBSCURA_PHASH_BIN` at it.
