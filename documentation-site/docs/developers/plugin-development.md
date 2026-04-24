---
sidebar_position: 3
title: Plugin Development
description: Build Obscura-native metadata plugins.
---

# Plugin Development

Obscura plugins add metadata providers for videos, series, galleries, images, audio, performers, studios, and tags. The runtime is intentionally explicit: every plugin has a `manifest.yml`, declares its capabilities, and receives a small JSON execution envelope.

The current source of truth is `packages/plugins/src/types.ts`.

## Manifest

Every plugin directory must include `manifest.yml`.

```yaml
id: tmdb
name: The Movie Database
version: 1.0.0
author: Obscura Community
description: Movie and series metadata from TMDB.
homepage: https://www.themoviedb.org/
isNsfw: false
tags:
  - movies
  - series
runtime: typescript
entry: dist/index.js
auth:
  - key: apiKey
    label: TMDB API Key
    required: true
    url: https://www.themoviedb.org/settings/api
capabilities:
  movieByName: true
  movieByURL: true
  seriesByName: true
  seriesByURL: true
  seriesCascade: true
  supportsBatch: true
```

## Runtime values

`runtime` must be one of:

| Runtime | Meaning |
| --- | --- |
| `typescript` | Loads a compiled JavaScript entry file through Node. |
| `python` | Runs a command from the `script` array and communicates through stdin/stdout. |
| `stash-compat` | Wraps a Stash scraper YAML definition through Obscura's adapter. |

Runtime-specific manifest fields:

| Field | Runtime | Meaning |
| --- | --- | --- |
| `entry` | `typescript` | Relative path to compiled JavaScript, such as `dist/index.js`. |
| `script` | `python` | Command plus arguments, such as `["python3", "plugin.py"]`. |
| `stashDefinition` | `stash-compat` | Relative path to the Stash YAML definition. |
| `requires` | `python` | Sibling package directories required by the plugin. |

## Auth fields

Auth fields are optional. Each field supports:

| Field | Meaning |
| --- | --- |
| `key` | Stable key passed to the plugin in the `auth` object. |
| `label` | Human-readable label in the Settings UI. |
| `required` | Whether the plugin needs the value to run. Defaults to true. |
| `url` | Optional link where the user can get the credential. |

Credentials are stored encrypted in the `plugin_auth` table and resolved into plaintext only for plugin execution.

## Capabilities

Capability keys are booleans. Declare only the actions the plugin actually supports.

```ts
type PluginCapabilities = {
  videoByURL?: boolean;
  videoByFragment?: boolean;
  videoByName?: boolean;
  folderByName?: boolean;
  folderByFragment?: boolean;
  folderCascade?: boolean;
  galleryByURL?: boolean;
  galleryByFragment?: boolean;
  imageByURL?: boolean;
  audioByURL?: boolean;
  audioByFragment?: boolean;
  audioLibraryByName?: boolean;
  performerByURL?: boolean;
  performerByFragment?: boolean;
  performerByName?: boolean;
  movieByName?: boolean;
  movieByURL?: boolean;
  movieByFragment?: boolean;
  seriesByName?: boolean;
  seriesByURL?: boolean;
  seriesByFragment?: boolean;
  seriesCascade?: boolean;
  episodeByName?: boolean;
  episodeByFragment?: boolean;
  supportsBatch?: boolean;
};
```

## Execution envelope

Native plugins receive this shape:

```ts
type PluginExecutionInput = {
  obscura_version: 1;
  action: string;
  auth: Record<string, string>;
  input?: PluginInput;
  batch?: Array<{
    id: string;
    input: PluginInput;
  }>;
};

type PluginInput = {
  url?: string;
  title?: string;
  name?: string;
  date?: string;
  details?: string;
  oshash?: string;
  checksumMd5?: string;
  phash?: string;
  duration?: number;
  filePath?: string;
  externalId?: string;
  seasonNumber?: number;
};
```

Plugins return either a single result or batch results:

```ts
type PluginExecutionOutput<T = unknown> = {
  ok: boolean;
  result?: T;
  results?: Array<{ id: string; result: T | null }>;
  error?: string;
};
```

For TypeScript plugins, export an object with `capabilities`, `execute`, and optionally `executeBatch`.

```ts
import type {OscuraPlugin} from '@obscura/plugins';

const plugin: OscuraPlugin = {
  capabilities: {
    movieByName: true,
    supportsBatch: true,
  },
  async execute(action, input, auth) {
    if (action !== 'movieByName') {
      return null;
    }

    return {
      title: input.title ?? null,
      date: null,
      details: null,
      urls: [],
      studioName: null,
      performerNames: [],
      tagNames: [],
      imageUrl: null,
      episodeNumber: null,
      series: null,
      code: null,
      director: null,
    };
  },
};

export default plugin;
```

## Safety expectations

- Keep provider-specific logic inside the plugin or adapter.
- Normalize external IDs and metadata into Obscura-owned shapes.
- Do not embed legacy Stash schema as Obscura's application schema.
- Treat network errors as recoverable plugin failures and return useful error strings.
