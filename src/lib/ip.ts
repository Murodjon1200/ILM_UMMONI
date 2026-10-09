import { isIP } from "node:net";

interface HeaderSource {
  get(name: string): string | null;
}

/**
 * Forwarded headers are attacker-controlled unless a trusted proxy is known to
 * overwrite them. Trusting them unconditionally lets anyone rotate `X-Real-IP`
 * per request and defeat IP-keyed rate limiting, and poisons the ip recorded in
 * AuditLog / LoginAttempt.
 *
 * Set TRUSTED_PROXY=true only when a proxy you control (Vercel, Cloudflare, an
 * nginx in front of this app) always rewrites these headers. Otherwise they are
 * ignored and the direct peer address is used.
 */
function proxyHeadersTrusted() {
  return process.env.TRUSTED_PROXY === "true";
}

function findValidIp(value: string | null) {
  if (!value) {
    return null;
  }

  for (const candidate of value.split(",")) {
    const ip = candidate.trim();

    if (isIP(ip) !== 0) {
      return ip;
    }
  }

  return null;
}

export function getTrustedClientIp(source: HeaderSource) {
  if (!proxyHeadersTrusted()) {
    return "unknown";
  }

  const trustedHeaders = [
    "x-vercel-forwarded-for",
    "cf-connecting-ip",
    "x-real-ip",
  ];

  for (const header of trustedHeaders) {
    const ip = findValidIp(source.get(header));

    if (ip) {
      return ip;
    }
  }

  return findValidIp(source.get("x-forwarded-for")) ?? "unknown";
}
