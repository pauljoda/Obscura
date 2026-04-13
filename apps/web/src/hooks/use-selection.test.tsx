import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSelection } from "./use-selection";

describe("useSelection", () => {
  it("toggles, selects, and clears selections", () => {
    const { result } = renderHook(() => useSelection());

    act(() => {
      result.current.toggle("a");
    });
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => {
      result.current.selectAll(["a", "b"]);
    });
    expect(result.current.isAllSelected(["a", "b"])).toBe(true);
    expect(result.current.count).toBe(2);

    act(() => {
      result.current.deselectAll();
    });
    expect(result.current.count).toBe(0);
  });
});
