import { fetchApi } from "./core";

export interface SystemStatus {
  migrations: Array<{
    name: string;
    description: string;
    status:
      | "pending"
      | "staging"
      | "staged"
      | "finalizing"
      | "complete"
      | "failed";
  }>;
  lockdown: {
    active: boolean;
    blockedBy: string | null;
    blockingStatus: string | null;
  };
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return fetchApi<SystemStatus>("/system/status");
}

export async function finalizeMigration(name: string): Promise<void> {
  await fetchApi<unknown>(
    `/system/migrations/${encodeURIComponent(name)}/finalize`,
    { method: "POST" },
  );
}
