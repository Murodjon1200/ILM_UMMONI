import {
  apiOk,
  createRouteHandler,
  parseLimit,
  readJson,
} from "@/lib/mobile/api-error";
import { saveGrade } from "@/lib/mobile/mutations";
import { listGrades } from "@/lib/mobile/queries";
import { requireMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHandler = createRouteHandler(async (request) => {
  const user = await requireMobileUser();

  return apiOk({ grades: await listGrades(user, parseLimit(request)) });
});

const postHandler = createRouteHandler(async (request) => {
  const user = await requireMobileUser();

  return apiOk(await saveGrade(user, await readJson(request)), 201);
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => getHandler(request, { params: {} }));
}

export async function POST(request: Request) {
  return withApiRateLimit(request, () => postHandler(request, { params: {} }));
}
