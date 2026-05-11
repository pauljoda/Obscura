# Release Update Alert Design

**Goal:** Let a self-hosted Obscura install quietly tell its user when a newer published release is available, while keeping private LAN installs calm when GitHub cannot be reached.

**Scope:** This pass covers a best-effort update check against GitHub releases, a sidebar badge state, and a changelog-dialog update link with manual refresh. It does not add persistent update preferences, automatic downloads, or Docker image management.

## Current Findings

Obscura already exposes the installed app version through `APP_VERSION`, sourced from the web package version. The sidebar footer shows that version inside `ChangelogDialog`, and the changelog content is served by `/api/changelog` through `@obscura/app-core`.

This creates a natural place for the feature:

- Keep the installed version badge visible at all times.
- Add one server-side release status endpoint beside the existing changelog endpoint.
- Let the sidebar and changelog dialog consume the same release status.

## Design

### Release Check

Add an `@obscura/app-core` release-check helper that fetches the latest published release from GitHub and compares it with the local version.

The helper will use GitHub's public latest-release endpoint for `pauljoda/Obscura`. It will normalize versions by removing a leading `v` and comparing only the numeric semantic-version core. A local version such as `0.22.1-dev` compares as base version `0.22.1`. If the local base is equal to or greater than GitHub's latest version, Obscura reports that no update is required, which keeps dev builds from warning when they are ahead of the latest release.

The helper returns a small status object:

- local version
- latest release version when known
- latest release URL when known
- whether an update is available
- whether the status came from cache
- last checked timestamp
- a quiet error state for callers that want diagnostics

Network failures should not throw through to the UI. The endpoint should return a normal "unknown" status so private installs without internet access do not show scary errors.

### API

Add `/api/update-check`.

Default requests use an in-memory server cache with a one-day TTL. Requests with `?force=1` bypass that cache and perform a fresh check for the manual action in the changelog dialog. The cache is intentionally process-local; if the app restarts, it can check again.

### User Experience

The sidebar version row remains the primary always-visible surface. When a newer release is available, the existing LED indicator changes to the brass active/glow style and the version label remains visible. If the install is current, ahead of the latest release, unchecked, or offline, the sidebar stays in its normal idle version state.

When the changelog dialog opens, it loads changelog text as it does today and also checks release status. If an update is available, the top of the dialog shows a compact link such as `Update available: v0.23.0`, pointing at the GitHub release. The dialog header also includes a manual refresh control so users can check again immediately.

Failed checks stay quiet in normal UI. A manual refresh may simply end with no update banner if GitHub cannot be reached.

### Testing

Add focused tests for:

- semantic version normalization and comparison, including `v` prefixes and `-dev` local versions
- update-available, up-to-date, dev-ahead, and fetch-failure release statuses
- cache reuse and forced refresh behavior
- the API route returning JSON for the helper result

Run Svelte autofixer on modified Svelte components and run the relevant Vitest suites before committing.
