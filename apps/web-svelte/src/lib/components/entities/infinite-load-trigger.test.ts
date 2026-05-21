import { describe, expect, it } from "vitest";
import { calculateLoadAheadThreshold } from "./infinite-load-trigger.svelte";

describe("infinite load trigger", () => {
  it("loads ahead by at least a screen-and-a-half", () => {
    expect(calculateLoadAheadThreshold({ baseThreshold: 500, clientHeight: 800 })).toBe(1200);
  });

  it("expands the load-ahead window when scroll velocity is high", () => {
    expect(calculateLoadAheadThreshold({
      baseThreshold: 500,
      clientHeight: 800,
      maxThreshold: 5000,
      scrollVelocity: 4,
      velocityLeadMs: 900,
    })).toBe(3600);
  });

  it("caps predictive load-ahead distance", () => {
    expect(calculateLoadAheadThreshold({
      baseThreshold: 500,
      clientHeight: 800,
      maxThreshold: 5000,
      scrollVelocity: 20,
      velocityLeadMs: 900,
    })).toBe(5000);
  });
});
