# Library Organization

Obscura organizes video libraries into two first-class kinds of content:
**Movies** (single-file releases) and **Series** (multi-episode shows, with
or without seasons). Each library root has independent toggles for what to
scan, and the on-disk folder layout decides what every file becomes.

This doc explains the rules, shows the layouts that work, and calls out the
ones that don't.

---

## The two toggles

Each library root has two video toggles configured in **Library settings**:

| Toggle       | Default | What it does                                                 |
|--------------|---------|--------------------------------------------------------------|
| `scanMovies` | on      | Files **at the library root** become movies.                  |
| `scanSeries` | on      | Files **inside subfolders** become episodes of a series.      |

Both can be on simultaneously (mixed library) or only one can be on
(pure-movie library or pure-series library).

---

## The depth rule

Obscura looks at how deep under the library root each file sits and routes
it accordingly. Counting the library root as depth 0:

| Depth | What it is                            | Becomes                  |
|-------|---------------------------------------|--------------------------|
| 0     | File at the library root              | Movie                    |
| 1     | File inside one folder                | Episode (flat series)    |
| 2     | File inside two folders               | Episode (seasoned series)|
| ≥ 3   | File buried deeper                    | **Rejected** (skipped)   |

Series detection is applied automatically: if every file under a series
folder lives directly inside it, the series is **flat** (one synthetic
season called Specials/Season 0). If at least one file lives inside a
recognized season folder, the whole series is treated as **seasoned**.

---

## Good layouts

### Movies-only library

```
/library/movies
├── Blade Runner (1982).mkv
├── Heat (1995).mp4
└── No Country for Old Men (2007).mkv
```

All three files are depth 0 → movies. `scanMovies` must be on.

### Flat series (Case A)

```
/library/series
└── My Cool Show
    ├── My Cool Show - 01.mkv
    ├── My Cool Show - 02.mkv
    └── My Cool Show - 03.mkv
```

Every episode lives directly inside `My Cool Show/`, so the series is
flat. All three episodes land in synthetic Season 0.

### Series with seasons (Case B)

```
/library/series
└── Another Show
    ├── Season 01
    │   ├── S01E01.mkv
    │   └── S01E02.mkv
    └── Season 02
        ├── S02E01.mkv
        └── S02E02.mkv
```

Each episode is depth 2, inside a recognized season folder. Episodes are
placed into Season 1 / Season 2 accordingly.

### Mixed library

```
/library
├── Heat (1995).mkv          ← movie (depth 0)
├── Blade Runner (1982).mkv  ← movie (depth 0)
└── Twin Peaks
    ├── Season 01
    │   └── S01E01.mkv       ← episode (depth 2)
    └── Season 02
        └── S02E01.mkv       ← episode (depth 2)
```

Both toggles on. Files at the root become movies, files in nested folders
become episodes.

### Specials folder

```
/library/series/Another Show
├── Season 01
│   └── S01E01.mkv
└── Specials
    └── Behind the Scenes.mkv
```

`Specials` is recognized as Season 0. Loose files at the series root in a
Case B series also fall back to Season 0.

---

## Bad layouts

### Too deep

```
/library/series/Show/Extras/Bonus/clip.mkv
```

`clip.mkv` is depth 3. Obscura rejects it and logs a warning. Move it up
or remove it from the library.

### Loose file with `scanMovies` off

```
/library
└── orphan.mkv
```

If `scanMovies` is off and `scanSeries` is on, `orphan.mkv` is silently
skipped. Either turn `scanMovies` on or move the file under a series
folder.

### File outside the library root

Symlinks or paths that resolve outside the configured root are rejected.

---

## Filename conventions

Filenames are parsed for season/episode numbers, year hints, and a clean
display title. The parsers are forgiving but consistent layouts are easier
to spot-check.

| Form                                    | Parsed as                       |
|-----------------------------------------|---------------------------------|
| `Show.S01E03.mkv` / `Show s1e3.mkv`     | Season 1, Episode 3             |
| `Show 1x03.mkv`                         | Season 1, Episode 3             |
| `Show - Season 1 - Episode 3.mkv`       | Season 1, Episode 3             |
| `Show - 053.mkv`                        | Absolute episode 53             |
| `Movie Title (2007).mkv`                | Title `Movie Title`, year 2007  |
| `Movie.Title.2007.1080p.mkv`            | Title `Movie Title`, year 2007  |

Resolution tokens like `1080p`, `2160p`, `BluRay` are stripped from the
title automatically.

---

## Metadata source priority

When Obscura imports a file, it merges metadata from several sources in
this order (later sources override earlier ones for fields they provide):

1. **Filename parser** — last-resort fallback for title, year, season,
   and episode numbers.
2. **JSON sidecar** — `<filename>.info.json` next to the video. Lower
   priority than NFO. Provides title, details, date, studio, rating,
   tags, performers, urls.
3. **NFO sidecar** — `<filename>.nfo` next to the video. Highest
   priority. Provides title, plot, aired date, studio, rating, tags,
   genres, urls.

User edits made in the Obscura UI are never overwritten by a re-scan.
The scanner only fills in fields that are currently empty.

---

## When to re-scan

A re-scan is safe and idempotent. It picks up new files, removes rows for
files that have been deleted from disk, and refreshes file size and
linkage. It will not touch user-edited fields like title overrides,
ratings, NSFW flags, watch progress, or the `organized` flag.

Re-scans are triggered automatically on a schedule and can be run
on-demand from the **Operations** dashboard.
