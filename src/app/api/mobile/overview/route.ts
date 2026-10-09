import { apiOk, createRouteHandler } from "@/lib/mobile/api-error";
import { getOverview } from "@/lib/mobile/queries";
import { requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async () => {
  const user = await requireMobileUser();

  return apiOk(await getOverview(user));
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}
