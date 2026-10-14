import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class MobileApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

export function unauthorized() {
  return new MobileApiError(401, "Authentication required.");
}

export function forbidden() {
  return new MobileApiError(403, "Access denied.");
}

export function notFound(message = "Record not found.") {
  return new MobileApiError(404, message);
}

export function badRequest(message: string) {
  return new MobileApiError(400, message);
}

export function conflict(message: string) {
  return new MobileApiError(409, message);
}

/**
 * Mobile responses can carry bearer credentials (e.g. the session token from
 * /api/mobile/session), so they must never be stored by any cache. `no-store`
 * alone is enough for modern caches; `Pragma`/`Expires` also cover legacy
 * intermediaries that predate it.
 */
const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Expires: "0",
  Pragma: "no-cache",
} as const;

export function apiError(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders },
  );
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: noStoreHeaders });
}

type RouteHandler = (
  request: Request,
  context: { params: Record<string, string> },
) => Promise<Response>;

export function createRouteHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof MobileApiError) {
        return apiError(error.status, error.message);
      }

      if (error instanceof ZodError) {
        return apiError(400, "Please check the submitted values.");
      }

      return apiError(500, "Something went wrong. Please try again.");
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest("A JSON body is required.");
  }
}

const maxLimit = 200;

export function parseLimit(request: Request, fallback = 100) {
  const raw = new URL(request.url).searchParams.get("limit");

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), maxLimit);
}
