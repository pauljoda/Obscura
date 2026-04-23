export async function readOptionalJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function readSfwOnlyFromRequest(
  request: Request,
  body: Record<string, unknown>,
): boolean {
  if (body.nsfw === "off") return true;
  return request.headers.get("x-obscura-nsfw-mode") === "off";
}
