import { createHash } from "node:crypto";
import { isIP } from "node:net";

interface HeaderSource {
  get(name: string): string | null;
}

/** Headers a trusted proxy sets to the single originating client address. */
const singleValueHeaders = ["cf-connecting-ip", "x-real-ip"];

/**
 * Forwarded headers are attacker-controlled unless a trusted proxy is known to
 * overwrite them. Trusting them unconditionally lets anyone rotate `X-Real-IP`
 * per request and defeat IP-keyed rate limiting, and poisons the ip recorded in
 * AuditLog / LoginAttempt.
 *
 * Set TRUSTED_PROXY=true only when a proxy you control (Cloudflare, an nginx in
 * front of this app, etc.) always rewrites these headers.
 */
function proxyHeadersTrusted() {
  return process.env.TRUSTED_PROXY === "true";
}

function parseIp(value: string | null | undefined) {
  const ip = value?.trim();

  return ip && isIP(ip) !== 0 ? ip : null;
}

/**
 * A single trusted proxy appends the address it actually saw to
 * `X-Forwarded-For`. The left-most entry is supplied by the client and is
 * trivially spoofable, so the right-most valid entry is used instead.
 */
function lastValidIp(value: string | null) {
  if (!value) {
    return null;
  }

  const entries = value.split(",");

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const ip = parseIp(entries[index]);

    if (ip) {
      return ip;
    }
  }

  return null;
}

/**
 * The client address as seen by a trusted proxy, or `null` when forwarding
 * headers must not be trusted.
 */
export function getTrustedClientIp(source: HeaderSource): string | null {
  if (!proxyHeadersTrusted()) {
    return null;
  }

  for (const header of singleValueHeaders) {
    const ip = parseIp(source.get(header));

    if (ip) {
      return ip;
    }
  }

  return lastValidIp(source.get("x-forwarded-for"));
}

/**
 * A stable, non-global key for rate limiting.
 *
 * When a trusted proxy is configured the real client IP is used. Otherwise the
 * forwarded headers cannot be believed, so a coarse fingerprint of stable
 * request headers is used as a fallback. Falling back to a single literal (the
 * previous `"unknown"`) collapsed every caller into one shared bucket, letting
 * one client exhaust the limit for everyone.
 */
export function getClientKey(source: HeaderSource) {
  const ip = getTrustedClientIp(source);

  if (ip) {
    return ip;
  }

  const fingerprint = [
    source.get("user-agent") ?? "",
    source.get("accept-language") ?? "",
    source.get("accept-encoding") ?? "",
  ].join("\n");

  return `fp:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 32)}`;
}
