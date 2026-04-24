---
sidebar_position: 2
title: Library Organization
description: How Obscura classifies movies, flat series, and seasoned series.
---

# Library Organization

Obscura classifies video files by their depth under a library root. The root itself is depth `0`.

| Depth | Example | Becomes |
| --- | --- | --- |
| `0` | `/library/Heat (1995).mkv` | Movie |
| `1` | `/library/My Show/Episode 01.mkv` | Episode in a flat series |
| `2` | `/library/My Show/Season 01/S01E01.mkv` | Episode in a seasoned series |
| `3+` | `/library/My Show/Extras/Bonus/clip.mkv` | Rejected |

## Movies

```text
/library/movies
|-- Blade Runner (1982).mkv
|-- Heat (1995).mp4
`-- No Country for Old Men (2007).mkv
```

Files directly under the root become movies.

## Flat series

```text
/library/series
`-- My Cool Show
    |-- My Cool Show - 01.mkv
    |-- My Cool Show - 02.mkv
    `-- My Cool Show - 03.mkv
```

Files one folder below the root become episodes in a flat series. Obscura stores them in a synthetic season.

## Seasoned series

```text
/library/series
`-- Another Show
    |-- Season 01
    |   |-- S01E01.mkv
    |   `-- S01E02.mkv
    `-- Season 02
        |-- S02E01.mkv
        `-- S02E02.mkv
```

Files two folders below the root become episodes in their season folder. A `Specials` folder maps to season `0`.

## Sidecar metadata

When a file is imported, Obscura merges metadata in this order:

1. Filename parser for fallback title, year, season, and episode numbers.
2. JSON sidecar such as `<filename>.info.json`.
3. NFO sidecar such as `<filename>.nfo`.

User edits made in the UI are not overwritten by a normal rescan.
