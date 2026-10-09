import { listApplications } from "@/lib/mobile/admin-mutations";
import { apiOk, createRouteHandler, parseLimit } from "@/lib/mobile/api-error";
import { requireAdmin } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async (request) => {
  await requireAdmin();

  return apiOk({ applications: await listApplications(parseLimit(request)) });
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}
