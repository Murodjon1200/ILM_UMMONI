import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Parent-only context: resolves the Parent row for the signed-in user. */
export const getParentContext = cache(async () => {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const parent = await db.parent.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!parent) {
    redirect("/unauthorized");
  }

  return { parent, session };
});