import { describe, expect, it } from "vitest";
import { mapPgBossStateToJobRunStatus } from "./jobs-reads";

describe("mapPgBossStateToJobRunStatus", () => {
  it("maps live pg-boss active jobs to active dashboard rows", () => {
    expect(
      mapPgBossStateToJobRunStatus({
        state: "active",
        startAfter: new Date("2026-05-08T10:00:00.000Z"),
      }),
    ).toBe("active");
  });

  it("maps created jobs scheduled for the future to delayed dashboard rows", () => {
    expect(
      mapPgBossStateToJobRunStatus(
        {
          state: "created",
          startAfter: new Date("2026-05-08T10:05:00.000Z"),
        },
        new Date("2026-05-08T10:00:00.000Z"),
      ),
    ).toBe("delayed");
  });

  it("maps immediately runnable created jobs to waiting dashboard rows", () => {
    expect(
      mapPgBossStateToJobRunStatus(
        {
          state: "created",
          startAfter: new Date("2026-05-08T09:59:00.000Z"),
        },
        new Date("2026-05-08T10:00:00.000Z"),
      ),
    ).toBe("waiting");
  });
});
