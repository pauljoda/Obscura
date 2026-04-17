import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

describe("ConfirmDeleteDialog", () => {
  it("renders the disk delete option when explicitly enabled", () => {
    const onDeleteFromLibrary = vi.fn();
    const onDeleteFromDisk = vi.fn();

    render(
      <ConfirmDeleteDialog
        open
        entityType="video"
        count={2}
        onClose={() => {}}
        onDeleteFromLibrary={onDeleteFromLibrary}
        onDeleteFromDisk={onDeleteFromDisk}
        allowDeleteFromDisk
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete from library" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete from disk" }));

    expect(onDeleteFromLibrary).toHaveBeenCalledTimes(1);
    expect(onDeleteFromDisk).toHaveBeenCalledTimes(1);
  });

  it("closes on escape when not loading", () => {
    const onClose = vi.fn();
    render(
      <ConfirmDeleteDialog
        open
        entityType="tag"
        count={1}
        onClose={onClose}
        onDeleteFromLibrary={() => {}}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
