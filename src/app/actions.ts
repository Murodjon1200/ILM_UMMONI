"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { phoneSchema } from "@/lib/phone";
import { sanitizeText } from "@/lib/sanitize";

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  courseId: z.string().trim().min(1),
});

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message: string;
}

export async function submitApplication(
  formData: FormData,
): Promise<ContactFormState> {
  const t = await getTranslations("landing.contactSection");
  const parsedApplication = applicationSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    courseId: formData.get("courseId"),
  });

  if (!parsedApplication.success) {
    return {
      status: "error",
      message: t("errorInvalid"),
    };
  }

  try {
    const course = await db.course.findUnique({
      where: { id: parsedApplication.data.courseId },
      select: { id: true },
    });

    if (!course) {
      return {
        status: "error",
        message: t("errorCourse"),
      };
    }

    const application = await db.application.create({
      data: {
        name: sanitizeText(parsedApplication.data.name, 80),
        phone: sanitizeText(parsedApplication.data.phone, 30),
        courseId: parsedApplication.data.courseId,
        status: "PENDING",
      },
    });

    await writeAuditLog({
      action: "APPLICATION_CREATE",
      entity: "Application",
      entityId: application.id,
      newValue: { courseId: application.courseId, status: application.status },
    });

    revalidatePath("/");

    return {
      status: "success",
      message: t("success"),
    };
  } catch {
    return {
      status: "error",
      message: t("errorSend"),
    };
  }
}
