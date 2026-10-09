/**
 * Admin-namespaced alias for PUT /api/mobile/applications/[id].
 */
import { updateApplicationStatus } from "@/lib/mobile/admin-mutations";
import { apiOk, createRouteHandler, readJson } from "@/lib/mobile/api-error";
import { requireAdmin } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(
  async (request, { params }: { params: Record<string, string> }) => {
    const admin = await requireAdmin();

    return apiOk(
      await updateApplicationStatus(admin.id, params.id, await readJson(request)),
    );
  },
);

export async function PUT(
  request: Request,
  { params }: { params: Record<string, string> },
) {
  return withApiRateLimit(request, () => handler(request, { params }));
}
