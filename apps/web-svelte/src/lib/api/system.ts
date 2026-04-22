export interface SystemStatus {
  awaitingBreakingConsent: boolean;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch("/api/system/status");
  if (!res.ok) {
    throw new Error(`system status ${res.status}`);
  }
  return res.json();
}

export async function acceptBreakingGate(): Promise<void> {
  const res = await fetch("/api/system/breaking-gate/accept", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`breaking gate accept ${res.status}`);
  }
}
