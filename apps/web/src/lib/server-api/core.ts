import "server-only";

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

export function buildQueryString(
  params: Record<string, string | number | null | undefined>,
  listParams?: Record<string, string[] | undefined>,
) {
  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }

  if (listParams) {
    for (const [key, values] of Object.entries(listParams)) {
      values?.forEach((value) => sp.append(key, value));
    }
  }

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
