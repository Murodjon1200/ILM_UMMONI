import type { Role } from "@prisma/client";
import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import authConfig from "@/auth.config";
import { defaultLocale, isLocale, routing } from "@/i18n/config";

const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

const protectedRoutes: Array<{ prefix: string; role: Role }> = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/teacher", role: "TEACHER" },
  { prefix: "/student", role: "STUDENT" },
  { prefix: "/owner", role: "OWNER" },
  { prefix: "/parent", role: "PARENT" },
];

/** Endpoints that must stay reachable before a session exists. */
const publicApiRoutes = ["/api/mobile/session"];

function isPublicApiRoute(pathname: string) {
  return publicApiRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function getPathLocale(pathname: string) {
  const segment = pathname.split("/")[1];
  return isLocale(segment) ? segment : null;
}

function getRequestLocale(request: Parameters<typeof intlMiddleware>[0], pathname: string) {
  const pathLocale = getPathLocale(pathname);
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;

  if (pathLocale) {
    return pathLocale;
  }

  return cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
}

function stripLocale(pathname: string) {
  const pathLocale = getPathLocale(pathname);
  return pathLocale ? pathname.slice(pathLocale.length + 1) || "/" : pathname;
}

/**
 * The real inbound origin, taken from proxy headers.
 *
 * Auth.js rewrites `request.url` to `NEXTAUTH_URL`/`AUTH_URL`
 * (see next-auth/lib/env.js#reqWithEnvURL) and next-intl builds its
 * redirects/rewrites from `request.url`. When `NEXTAUTH_URL` does not match
 * the host actually serving the app (e.g. behind a reverse proxy), that rewrite
 * produces cross-origin redirects and an infinite loop (HTTP 508). Building
 * every redirect from the inbound host keeps the middleware independent of
 * `NEXTAUTH_URL`.
 */
function getRequestOrigin(request: NextRequest) {
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const rawProtocol = forwardedProto ?? request.nextUrl.protocol ?? "https:";
  const proto = rawProtocol.endsWith(":") ? rawProtocol : `${rawProtocol}:`;

  return `${proto}//${host}`;
}

/** Clone the request with its original origin so next-intl never redirects cross-domain. */
function withRequestOrigin(request: NextRequest) {
  const origin = getRequestOrigin(request);

  if (request.nextUrl.origin === origin) {
    return request;
  }

  const url = new URL(request.url);
  const parsedOrigin = new URL(origin);
  url.protocol = parsedOrigin.protocol;
  url.host = parsedOrigin.host;

  return new NextRequest(url, {
    headers: request.headers,
    method: request.method,
  });
}

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthApiRoute =
    pathname === "/api/auth" || pathname.startsWith("/api/auth/");

  if (isApiRoute) {
    if (isAuthApiRoute || isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }

    if (!request.auth) {
      return jsonError(401, "Authentication required.");
    }

    const matchedApiRoute = protectedRoutes.find(
      ({ prefix }) =>
        pathname === `/api${prefix}` || pathname.startsWith(`/api${prefix}/`),
    );

    if (matchedApiRoute && request.auth.user.role !== matchedApiRoute.role) {
      return jsonError(403, "Access denied.");
    }

    return NextResponse.next();
  }

  const locale = getRequestLocale(request, pathname);
  const routePath = stripLocale(pathname);
  const user = request.auth;
  const origin = getRequestOrigin(request);
  const matchedRoute = protectedRoutes.find(
    ({ prefix }) => routePath === prefix || routePath.startsWith(`${prefix}/`),
  );

  if ((matchedRoute || routePath === "/dashboard") && !user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, origin));
  }

  if (matchedRoute && user && user.user.role !== matchedRoute.role) {
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, origin));
  }

  return intlMiddleware(withRequestOrigin(request));
});

export const config = {
  matcher: [
    // `.*\..*` keeps the intl middleware away from real files in public/
    // (logo.png, favicon, icons). Without it every static asset is treated as a
    // missing locale route and 404s.
    "/((?!api|_next|.*\\..*).*)",
    "/api/:path*",
  ],
};
