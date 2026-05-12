import { API_BASE } from "./core";

export async function orvalFetch<TData>(
  url: string,
  init?: RequestInit,
): Promise<TData> {
  const path = url.startsWith("/api/") ? url.slice(4) : url;
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const data =
    text.length === 0
      ? undefined
      : contentType.includes("application/json")
        ? JSON.parse(text)
        : text;

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as TData;
}
