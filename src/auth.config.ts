import type { NextAuthConfig } from "next-auth";

const authConfig = {
  // Trust the proxy-provided host header (e.g. X-Forwarded-Host).
  // Without this, Auth.js throws UntrustedHost unless NEXTAUTH_URL /
  // AUTH_TRUST_HOST is configured, which breaks middleware on every route.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  cookies:
    process.env.NODE_ENV === "production"
      ? {
          sessionToken: {
            name: "__Secure-ilmummoni.session-token",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
        }
      : undefined,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
