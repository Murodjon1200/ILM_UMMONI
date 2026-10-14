import { z } from "zod";

import { db } from "@/lib/db";
import {
  apiOk,
  badRequest,
  conflict,
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
 * Registers the device for push notifications. The token column is unique, so a
 * device that signs out and back in is re-pointed to the current user. A token
 * that already belongs to a different account is never reassigned: sign-out
 * removes the previous owner's token first (`DELETE` below), so reaching this
 * branch means another account's device was targeted and the request is
 * rejected instead of hijacking its notifications.
 */
const postHandler = createRouteHandler(async (request) => {
  const user = await requireMobileUser();
  const parsed = bodySchema.safeParse(await readJson(request));

  if (!parsed.success) {
    throw badRequest("A valid Expo push token is required.");
  }

  const { token, platform } = parsed.data;
  const existing = await db.expoPushToken.findUnique({
    where: { token },
    select: { userId: true },
  });

  if (existing && existing.userId !== user.id) {
    throw conflict("This device is already linked to another account.");
  }

  await db.expoPushToken.upsert({
    where: { token },
    create: { token, userId: user.id, platform: platform ?? null },
    update: { platform: platform ?? null },
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
