import { getAdminStats } from "@/lib/mobile/admin-mutations";
import { apiOk, createRouteHandler } from "@/lib/mobile/api-error";
import { requireAdmin } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async () => {
  await requireAdmin();

  return apiOk({ stats: await getAdminStats() });
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}
