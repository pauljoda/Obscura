export interface ResolveClientInfoInput {
  socketIp?: string | null;
  forwardedFor?: string | null;
}

export interface ClientInfo {
  clientIp: string;
  isLan: boolean;
}

export function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function isLanIp(ip: string): boolean {
  if (isLoopback(ip)) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;

  const mapped = ip.match(/^::ffff:(.+)$/);
  if (mapped) return isLanIp(mapped[1]);

  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const octet = Number.parseInt(match172[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  if (ip.startsWith("fd") || ip.startsWith("fc")) return true;
  return false;
}

export function resolveClientInfo(input: ResolveClientInfoInput): ClientInfo {
  const socketIp = input.socketIp?.trim() ?? "";
  const isFromTrustedProxy = isLoopback(socketIp);

  let clientIp = socketIp;
  if (isFromTrustedProxy) {
    const forwarded = input.forwardedFor?.split(",")[0]?.trim();
    if (forwarded) clientIp = forwarded;
  }

  return {
    clientIp,
    isLan: isLanIp(clientIp),
  };
}
