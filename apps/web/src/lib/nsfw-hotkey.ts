/** True when Cmd/Ctrl + Shift + U (physical KeyU), for SFW ↔ NSFW quick toggle. */
export function isModShiftU(e: KeyboardEvent): boolean {
  if (!e.metaKey && !e.ctrlKey) return false;
  if (!e.shiftKey) return false;
  if (e.altKey) return false;
  return e.code === "KeyU" || e.key?.toLowerCase() === "u";
}
