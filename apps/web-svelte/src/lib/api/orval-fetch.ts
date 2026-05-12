import { dev } from "$app/environment";
import { env } from "$env/dynamic/public";
import { API_BASE } from "./core";

const V2_API_BASE =
  env.PUBLIC_V2_API_URL ||
  (dev && API_BASE === "/api" ? "http://127.0.0.1:8010/api" : API_BASE);

export async function orvalFetch<TData>(
  url: string,
  init?: RequestInit,
): Promise<TData> {
  const path = url.startsWith("/api/") ? url.slice(4) : url;
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${V2_API_BASE}${path}`, {
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
