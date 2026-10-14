import { createHash } from "node:crypto";

import { getClientKey } from "@/lib/ip";
import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

interface RateLimitPolicy {
  duration: number;
  points: number;
}

const apiLimit: RateLimitPolicy = {
  duration: 60,
  points: 120,
};

const loginEndpointLimit: RateLimitPolicy = {
  duration: 15 * 60,
  points: 20,
};

/**
 * A tighter budget for state-changing requests so a single account cannot
 * hammer mutating endpoints (payments, reminders, attendance, grades, ...).
 */
const mutationLimit: RateLimitPolicy = {
  duration: 60,
  points: 30,
};

const apiRateLimiter = new RateLimiterMemory(apiLimit);
const loginEndpointRateLimiter = new RateLimiterMemory(loginEndpointLimit);
const mutationRateLimiter = new RateLimiterMemory(mutationLimit);

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getClientIp(request: Request) {
  return getClientKey(request.headers);
}

/**
 * Rate-limit key for authenticated mutations. Derived from the session cookie
 * so the budget follows the account/session rather than an easily-shared or
 * spoofed source address. Falls back to the client IP when no session exists.
 */
function getAccountKey(request: Request) {
  const cookie = request.headers.get("cookie");
  const token = cookie?.match(
    /(?:^|;\s*)[^=;]*session-token=([^;]+)/,
  )?.[1];

  if (token) {
    return `sess:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
  }

  return getClientIp(request);
}

function isLoginEndpoint(request: Request) {
  return (
    /\/api\/auth\/(callback|signin)\/credentials/.test(request.url) ||
    /\/api\/mobile\/session$/.test(request.url)
  );
}

export async function withApiRateLimit(
  request: Request,
  handler: () => Promise<Response>,
) {
  const loginRequest = isLoginEndpoint(request);
  const limiter = loginRequest ? loginEndpointRateLimiter : apiRateLimiter;
  const policy = loginRequest ? loginEndpointLimit : apiLimit;
  const ip = getClientIp(request);

  const checks: Array<[RateLimiterMemory, string]> = [[limiter, ip]];

  if (mutationMethods.has(request.method.toUpperCase())) {
    checks.push([mutationRateLimiter, getAccountKey(request)]);
  }

  let remainingPoints = policy.points;
  let msBeforeNext = policy.duration * 1000;

  try {
    for (const [limiterInstance, key] of checks) {
      const result = await limiterInstance.consume(key, 1);
      remainingPoints = Math.min(remainingPoints, result.remainingPoints);
      msBeforeNext = Math.min(msBeforeNext, result.msBeforeNext);
    }
  } catch {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(policy.duration)),
        },
      },
    );
  }

  const response = await handler();
  const resetAt = Math.ceil((Date.now() + msBeforeNext) / 1000);
  const headers = new Headers(response.headers);
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  headers.delete("set-cookie");
  headers.set("RateLimit-Limit", String(policy.points));
  headers.set("RateLimit-Remaining", String(remainingPoints));
  headers.set("RateLimit-Reset", String(resetAt));

  const wrappedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  for (const setCookie of setCookies) {
    wrappedResponse.headers.append("set-cookie", setCookie);
  }

  return wrappedResponse;
}
