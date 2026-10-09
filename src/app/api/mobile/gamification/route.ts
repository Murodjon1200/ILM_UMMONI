import { apiOk, createRouteHandler } from "@/lib/mobile/api-error";
import { getGamification } from "@/lib/mobile/gamification";
import { requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async () => {
  const user = await requireMobileUser();

  return apiOk({ gamification: await getGamification(user) });
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}