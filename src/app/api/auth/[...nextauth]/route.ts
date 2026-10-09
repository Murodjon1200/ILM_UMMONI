import type { NextRequest } from "next/server";

import { handlers } from "@/auth";
import { withApiRateLimit } from "@/lib/rate-limit";

async function limitedHandler(request: NextRequest) {
  return withApiRateLimit(request, () =>
    request.method === "GET"
      ? handlers.GET(request)
      : handlers.POST(request),
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { limitedHandler as GET, limitedHandler as POST };
