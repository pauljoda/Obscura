import { resolveClientInfo } from "@obscura/app-core";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ getClientAddress, request }) => {
  const info = resolveClientInfo({
    socketIp: getClientAddress(),
    forwardedFor: request.headers.get("x-forwarded-for"),
  });

  return Response.json({ isLan: info.isLan });
};
