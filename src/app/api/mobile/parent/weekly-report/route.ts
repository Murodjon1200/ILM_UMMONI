import { apiOk, createRouteHandler } from "@/lib/mobile/api-error";
import { weeklyReport } from "@/lib/mobile/parent-report";
import { requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async () => {
  const user = await requireMobileUser();

  return apiOk({ report: await weeklyReport(user) });
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}