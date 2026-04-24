import { describe, expect, it, vi } from "vitest";
import { createDbRuntime } from "./runtime";

describe("createDbRuntime", () => {
  it("reuses the existing state when the connection string does not change", async () => {
    const end = vi.fn();
    const createQueryClient = vi.fn(() => ({ end }));
    const createDatabase = vi.fn((client: { end: () => void }) => ({ client }));
    const runtime = createDbRuntime({
      createQueryClient,
      createDatabase,
      closeQueryClient: async (client) => client.end(),
    });

    await runtime.configure("postgres://one");
    const first = runtime.getDatabase();
    await runtime.configure("postgres://one");
    const second = runtime.getDatabase();

    expect(second).toBe(first);
    expect(createQueryClient).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
  });

  it("rebuilds state and closes the previous client when the connection string changes", async () => {
    const ends: Array<() => void> = [];
    const createQueryClient = vi.fn((url: string) => {
      const end = vi.fn();
      ends.push(end);
      return { url, end };
    });
    const createDatabase = vi.fn((client: { url: string; end: () => void }) => ({ url: client.url }));
    const runtime = createDbRuntime({
      createQueryClient,
      createDatabase,
      closeQueryClient: async (client) => client.end(),
    });

    await runtime.configure("postgres://one");
    const first = runtime.getDatabase();
    await runtime.configure("postgres://two");
    const second = runtime.getDatabase();

    expect(second).not.toBe(first);
    expect(createQueryClient).toHaveBeenCalledTimes(2);
    expect(ends[0]).toHaveBeenCalledTimes(1);
    expect(ends[1]).not.toHaveBeenCalled();
  });

  it("throws when getDatabase is called before configure", () => {
    const runtime = createDbRuntime({
      createQueryClient: () => ({ end: () => {} }),
      createDatabase: () => ({}),
    });
    expect(() => runtime.getDatabase()).toThrow();
    expect(() => runtime.getClient()).toThrow();
  });
});
