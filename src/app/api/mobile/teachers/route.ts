import { listTeachers } from "@/lib/mobile/queries";
import { createTeacher } from "@/lib/mobile/admin-mutations";
import { apiOk, createRouteHandler, readJson } from "@/lib/mobile/api-error";
import { requireAdmin, requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHandler = createRouteHandler(async () => {
  const user = await requireMobileUser();

  return apiOk({ teachers: await listTeachers(user) });
});

const postHandler = createRouteHandler(async (request) => {
  const admin = await requireAdmin();
  const result = await createTeacher(admin.id, await readJson(request));

  return apiOk(result, 201);
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => getHandler(request, { params: {} }));
}

export async function POST(request: Request) {
  return withApiRateLimit(request, () => postHandler(request, { params: {} }));
}
