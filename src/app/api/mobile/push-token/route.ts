import { z } from "zod";

import { db } from "@/lib/db";
import {
  apiOk,
  badRequest,
  createRouteHandler,
  readJson,
} from "@/lib/mobile/api-error";
import { requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z
    .string()
    .trim()
    .min(10)
    .max(200)
    .regex(/^Expo(nent)?PushToken\[.+\]$/, "Not an Expo push token."),
  platform: z.enum(["ios", "android"]).optional(),
});

/**
 * Registers the device for push notifications. The token column is unique, so
 * upserting re-points a device that switched accounts to the current user.
 */
const postHandler = createRouteHandler(async (request) => {
  const user = await requireMobileUser();
  const parsed = bodySchema.safeParse(await readJson(request));

  if (!parsed.success) {
    throw badRequest("A valid Expo push token is required.");
  }

  const { token, platform } = parsed.data;

  await db.expoPushToken.upsert({
    where: { token },
    create: { token, userId: user.id, platform: platform ?? null },
    update: { userId: user.id, platform: platform ?? null },
  });

  return apiOk({ registered: true }, 201);
});

/** Called on sign-out so the device stops receiving the previous user's push. */
const deleteHandler = createRouteHandler(async (request) => {
  const user = await requireMobileUser();
  const parsed = z
    .object({ token: z.string().trim().min(1).max(200) })
    .safeParse(await readJson(request));

  if (!parsed.success) {
    throw badRequest("A push token is required.");
  }

  await db.expoPushToken.deleteMany({
    where: { token: parsed.data.token, userId: user.id },
  });

  return apiOk({ removed: true });
});

export async function POST(request: Request) {
  return withApiRateLimit(request, () => postHandler(request, { params: {} }));
}

export async function DELETE(request: Request) {
  return withApiRateLimit(request, () => deleteHandler(request, { params: {} }));
}
