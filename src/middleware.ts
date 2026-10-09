import type { Role } from "@prisma/client";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
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
  const matchedRoute = protectedRoutes.find(
    ({ prefix }) => routePath === prefix || routePath.startsWith(`${prefix}/`),
  );

  if ((matchedRoute || routePath === "/dashboard") && !user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  if (matchedRoute && user && user.user.role !== matchedRoute.role) {
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, request.url));
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    // `.*\..*` keeps the intl middleware away from real files in public/
    // (logo.png, favicon, icons). Without it every static asset is treated as a
    // missing locale route and 404s. _vercel is excluded for the same reason.
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/api/:path*",
  ],
};
