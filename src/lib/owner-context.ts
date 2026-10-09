import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export const getOwnerContext = cache(async () => {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "OWNER") {
    redirect("/unauthorized");
  }

  const owner = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, phone: true },
  });

  if (!owner) {
    redirect("/unauthorized");
  }

  return { owner, session };
});
