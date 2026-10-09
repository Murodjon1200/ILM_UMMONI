import { apiOk, createRouteHandler } from "@/lib/mobile/api-error";
import { getMobileUser } from "@/lib/mobile/session";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createRouteHandler(async () => {
  const user = await getMobileUser();

  if (!user) {
    return apiOk({ user: null }, 200);
  }

  return apiOk({ user });
});

export async function GET(request: Request) {
  return withApiRateLimit(request, () => handler(request, { params: {} }));
}
