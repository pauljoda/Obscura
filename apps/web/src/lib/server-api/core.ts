import "server-only";

export { buildQueryString } from "../query-string";

const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

export async function serverFetch<T>(
  path: string,
  options?: { revalidate?: number | false; tags?: string[] },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: {
      revalidate: options?.revalidate ?? 30,
      tags: options?.tags,
    },
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}
