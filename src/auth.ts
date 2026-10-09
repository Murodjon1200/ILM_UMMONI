import { randomBytes } from "node:crypto";

import { compare, hash } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import authConfig from "@/auth.config";
import { getRequestContext, writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  clearFailedLoginAttempts,
  isLoginBlocked,
  recordFailedLogin,
} from "@/lib/login-security";
import { phoneSchema } from "@/lib/phone";
import { getClientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  password: z.string().min(1).max(72),
  phone: phoneSchema,
});

/**
 * Fails closed: if a failure cannot be recorded then the lockout counter is not
 * being enforced, so the attempt is denied rather than silently allowed. This
 * mirrors how a failed audit-log write is already handled below.
 */
async function handleFailedLogin(ip: string, phone: string) {
  try {
    await recordFailedLogin(ip, phone);
  } catch {
    return false;
  }

  return true;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Phone and password",
      credentials: {
        phone: {
          label: "Telefon raqam",
          type: "tel",
        },
        password: {
          label: "Parol",
          type: "password",
        },
      },
      async authorize(credentials, request) {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const phone = parsedCredentials.data.phone;
        const password = parsedCredentials.data.password;
        const ip = getClientIp(request);

        if (await isLoginBlocked(ip, phone)) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { phone },
        });
        const passwordHash =
          user?.password ??
          (await hash(randomBytes(24).toString("hex"), 12));
        const passwordMatches = await compare(password, passwordHash);

    if (!user || !passwordMatches) {
      if (!(await handleFailedLogin(ip, phone))) {
        return null;
      }

      return null;
    }

        try {
          await clearFailedLoginAttempts(ip, phone);
          await writeAuditLog({
            userId: user.id,
            action: "LOGIN",
            entity: "User",
            entityId: user.id,
            newValue: { phone: user.phone, role: user.role },
            context: getRequestContext(request.headers),
          });
        } catch {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : undefined;
      const userId = token?.id ?? token?.sub;

      if (!userId) {
        return;
      }

      try {
        await writeAuditLog({
          userId,
          action: "LOGOUT",
          entity: "User",
          entityId: userId,
        });
      } catch {
        return;
      }
    },
  },
});
