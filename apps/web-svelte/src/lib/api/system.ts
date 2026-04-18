import { fetchApi } from "./core";

export interface SystemStatus {
  awaitingBreakingConsent: boolean;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return fetchApi<SystemStatus>("/system/status");
}

export async function acceptBreakingGate(): Promise<void> {
  await fetchApi<unknown>("/system/breaking-gate/accept", { method: "POST" });
}
