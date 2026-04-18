# Server data layer — SvelteKit conventions

## Fetching

- `+page.server.ts` / `+layout.server.ts` destructure `fetch` from the event
  and pass it to `serverFetch(fetch, "/path")` so SvelteKit can track the
  upstream request for SSR streaming + hydration.
- `INTERNAL_API_URL` (private) is the server-side base. In dev it is
  `http://localhost:4000`. In the unified Docker image it is still
  `http://localhost:4000` — everything lives on the same machine, nginx is
  only used for the browser-facing ingress.

## Invalidation — replacing `revalidateTag`

SvelteKit does not have a cross-request cache like Next.js. We use
`depends(key)` + `invalidate(key)` instead:

```ts
// +page.server.ts
export const load = async ({ fetch, depends }) => {
  depends("videos");          // register key
  depends(`videos:${id}`);    // fine-grained
  return { videos: await serverFetch(fetch, "/videos") };
};
```

```ts
// client code after a mutation
import { invalidate } from "$app/navigation";
await updateVideo(id, patch);
await invalidate("videos");           // reruns any load that depends("videos")
await invalidate(`videos:${id}`);
```

### Behaviour vs Next.js

- **Scope**: `invalidate()` is per-client/per-tab. Two browsers hitting the
  same page will each run their own `load` at their own pace.
- **Source of truth**: Postgres (via the Fastify API). Losing Next.js's
  cross-request tag cache just means we don't memoise an upstream response
  between visitors — correctness is unchanged.
- **Load keys**: prefer concrete entity keys (`videos:{id}`) so a detail-page
  mutation doesn't force every list page to reload.

## Tag conventions

| Tag                                  | Used by                                |
| ------------------------------------ | -------------------------------------- |
| `videos`                             | `/videos`, dashboard recent lists      |
| `videos:{id}`                        | `/videos/[id]`, `/videos/[id]/edit`    |
| `video-series`                       | `/videos?series=…`                     |
| `video-series:{id}`                  | series detail                          |
| `galleries`                          | `/galleries`                           |
| `galleries:{id}`                     | `/galleries/[id]` + image lightbox     |
| `images`                             | `/images`                              |
| `images:{id}`                        | `/images/[id]`                         |
| `audio-libraries`                    | `/audio`                               |
| `audio-libraries:{id}`               | `/audio/[id]`                          |
| `audio-tracks:{id}`                  | `/audio/tracks/[id]`                   |
| `performers` / `performers:{id}`     | performer routes                       |
| `studios` / `studios:{id}`           | studio routes                          |
| `tags` / `tags:{id}`                 | tag routes                             |
| `collections` / `collections:{id}`   | collection routes                      |
| `scrapers`                           | scraper config / run results           |
| `library`                            | library config + stats                 |
| `system`                             | health / breaking-gate probe           |
