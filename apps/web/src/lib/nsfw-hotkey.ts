/** True when Cmd/Ctrl + Shift + Z (physical KeyZ), for SFW ↔ full NSFW quick toggle. */
export function isModShiftZ(e: KeyboardEvent): boolean {
  if (!e.metaKey && !e.ctrlKey) return false;
  if (!e.shiftKey || e.altKey) return false;
  return e.code === "KeyZ" || e.key?.toLowerCase() === "z";
}
