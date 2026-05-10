import { redirect } from "@sveltejs/kit";
import type { NsfwMode } from "$lib/nsfw/cookie";

export function redirectHiddenNsfwDetail(
  nsfwMode: NsfwMode,
  entity: { isNsfw?: boolean | null },
): void {
  if (nsfwMode === "off" && entity.isNsfw === true) {
    redirect(303, "/");
  }
}
