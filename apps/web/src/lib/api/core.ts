export { buildQueryString } from "../query-string";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function uploadFile<T>(
  path: string,
  file: File,
  extraFields?: Record<string, string>,
): Promise<T> {
  const form = new FormData();
  // Extra fields are appended BEFORE the file so the server can read
  // them off file.fields / via iterative parts() before consuming the
  // file stream (critical for routes like /scenes/upload that need
  // libraryRootId before accepting the payload).
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      form.append(key, value);
    }
  }
  form.append("file", file);

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export function toApiUrl(assetPath: string | null | undefined, cacheBust?: string) {
  if (!assetPath) {
    return undefined;
  }

  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return cacheBust ? `${assetPath}?v=${encodeURIComponent(cacheBust)}` : assetPath;
  }

  const url = `${API_BASE}${assetPath}`;
  return cacheBust ? `${url}?v=${encodeURIComponent(cacheBust)}` : url;
}
