import { listStudents } from "@/lib/mobile/queries";
import { createStudent } from "@/lib/mobile/admin-mutations";
import {
  apiOk,
  createRouteHandler,
  parseLimit,
  readJson,
} from "@/lib/mobile/api-error";
import { requireAdmin, requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHandler = createRouteHandler(async (request) => {
  const user = await requireMobileUser();

  return apiOk({
    students: await listStudents(user, parseLimit(request, 200)),
  });
});

const postHandler = createRouteHandler(async (request) => {
  const admin = await requireAdmin();
  const result = await createStudent(admin.id, await readJson(request));

  return apiOk(result, 201);
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => getHandler(request, { params: {} }));
}

export async function POST(request: Request) {
  return withApiRateLimit(request, () => postHandler(request, { params: {} }));
}
