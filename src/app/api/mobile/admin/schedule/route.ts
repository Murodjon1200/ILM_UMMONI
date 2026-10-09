/**
 * Admin-namespaced alias for POST /api/mobile/schedules.
 * Singular path kept for parity with the requested spec.
 */
import { createSchedule } from "@/lib/mobile/admin-mutations";
import { apiOk, createRouteHandler, readJson } from "@/lib/mobile/api-error";
import { requireAdmin } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async (request) => {
  const admin = await requireAdmin();

  return apiOk(await createSchedule(admin.id, await readJson(request)), 201);
});

export async function POST(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}
