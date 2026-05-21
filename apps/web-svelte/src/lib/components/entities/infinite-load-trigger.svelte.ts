interface LoadAheadThresholdInput {
  baseThreshold: number;
  clientHeight: number;
  maxThreshold?: number;
  screenLead?: number;
  scrollVelocity?: number;
  velocityLeadMs?: number;
}

export function calculateLoadAheadThreshold({
  baseThreshold,
  clientHeight,
  maxThreshold = 5000,
  screenLead = 1.5,
  scrollVelocity = 0,
  velocityLeadMs = 900,
}: LoadAheadThresholdInput): number {
  const screenThreshold = clientHeight * screenLead;
  const velocityThreshold = scrollVelocity * velocityLeadMs;
  return Math.min(maxThreshold, Math.ceil(Math.max(baseThreshold, screenThreshold, velocityThreshold)));
}
