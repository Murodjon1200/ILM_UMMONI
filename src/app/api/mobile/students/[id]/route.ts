import { updateStudent } from "@/lib/mobile/admin-mutations";
import { apiOk, createRouteHandler, readJson } from "@/lib/mobile/api-error";
import { requireAdmin } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(
  async (request, { params }: { params: Record<string, string> }) => {
    const admin = await requireAdmin();
    const result = await updateStudent(
      admin.id,
      params.id,
      await readJson(request),
    );

    return apiOk(result);
  },
);

export async function PUT(
  request: Request,
  { params }: { params: Record<string, string> },
) {
  return withApiRateLimit(request, () => handler(request, { params }));
}
