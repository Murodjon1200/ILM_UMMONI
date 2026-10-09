import { cookies } from "next/headers";
import { z } from "zod";

import { signIn } from "@/auth";
import { db } from "@/lib/db";
import {
  apiError,
  apiOk,
  createRouteHandler,
  readJson,
} from "@/lib/mobile/api-error";
import { phoneSchema } from "@/lib/phone";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  password: z.string().min(1).max(72),
  phone: phoneSchema,
});

/**
 * Mobile login. React Native's fetch cannot read `set-cookie`, so instead of
 * relying on a cookie jar we return the NextAuth session token in the body.
 * The client replays it as a `Cookie` header, which `auth()` already understands,
 * so every existing role check keeps working unchanged.
 */
const handler = createRouteHandler(async (request) => {
  const body = await readJson(request);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return apiError(400, "Enter a valid phone number and password.");
  }

  const { phone, password } = parsed.data;
  let result: string;

  try {
    result = await signIn("credentials", { phone, password, redirect: false });
  } catch {
    return apiError(401, "Phone number or password is incorrect.");
  }

  if (typeof result !== "string" || result.includes("error=")) {
    return apiError(401, "Phone number or password is incorrect.");
  }

  const jar = await cookies();
  const sessionCookie = jar
    .getAll()
    .find((cookie) => cookie.name.includes("session-token"));

  if (!sessionCookie) {
    return apiError(500, "Session could not be created. Please try again.");
  }

  // `signIn` already verified this phone/password pair, so resolving the user by
  // phone is safe here: `auth()` cannot read the cookie that was just set.
  const user = await db.user.findUnique({
    where: { phone },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  if (!user) {
    return apiError(401, "Phone number or password is incorrect.");
  }

  return apiOk({
    sessionCookie: `${sessionCookie.name}=${sessionCookie.value}`,
    user,
  });
});

export async function POST(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}
