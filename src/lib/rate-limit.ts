import { getTrustedClientIp } from "@/lib/ip";
import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

const apiLimit = {
  duration: 60,
  points: 120,
};

const loginEndpointLimit = {
  duration: 15 * 60,
  points: 20,
};

const apiRateLimiter = new RateLimiterMemory(apiLimit);
const loginEndpointRateLimiter = new RateLimiterMemory(loginEndpointLimit);

export function getClientIp(request: Request) {
  return getTrustedClientIp(request.headers);
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
  let remainingPoints = 0;
  let msBeforeNext = policy.duration * 1000;

  try {
    const result = await limiter.consume(ip, 1);
    remainingPoints = result.remainingPoints;
    msBeforeNext = result.msBeforeNext;
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
