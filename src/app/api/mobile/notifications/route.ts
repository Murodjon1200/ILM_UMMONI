import { apiOk, createRouteHandler } from "@/lib/mobile/api-error";
import { listNotifications, markNotificationsRead } from "@/lib/mobile/queries";
import { requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHandler = createRouteHandler(async () => {
  const user = await requireMobileUser();

  return apiOk({ notifications: await listNotifications(user) });
});

/** Opening the alerts tab marks everything read so the badge clears. */
const postHandler = createRouteHandler(async () => {
  const user = await requireMobileUser();

  return apiOk(await markNotificationsRead(user));
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => getHandler(request, { params: {} }));
}

export async function POST(request: Request) {
  return withApiRateLimit(request, () => postHandler(request, { params: {} }));
}
