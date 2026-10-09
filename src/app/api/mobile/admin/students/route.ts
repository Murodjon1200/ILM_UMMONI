/**
 * Admin-namespaced alias for POST /api/mobile/students.
 * Delegates to the same mutation so there is exactly one implementation.
 */
import { createStudent } from "@/lib/mobile/admin-mutations";
import { apiOk, createRouteHandler, readJson } from "@/lib/mobile/api-error";
import { requireAdmin } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async (request) => {
  const admin = await requireAdmin();

  return apiOk(await createStudent(admin.id, await readJson(request)), 201);
});

export async function POST(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}
