import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import FilterPresetDropdown from "./FilterPresetDropdown.svelte";

describe("FilterPresetDropdown", () => {
  it("renders the dismiss overlay as a button instead of a generic div", async () => {
    const user = userEvent.setup();
    render(FilterPresetDropdown, {
      props: {
        presets: [],
        activePresetId: null,
      },
    });

    await user.click(screen.getByRole("button", { name: /presets/i }));

    expect(
      screen.getByRole("button", { name: /close preset menu/i }),
    ).toBeInTheDocument();
  });
});
