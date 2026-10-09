import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/mobile/api-error";

export interface MobileUser {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: Role;
}

export async function getMobileUser(): Promise<MobileUser | null> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  if (!user) {
    return null;
  }

  return user;
}

export async function requireMobileUser(): Promise<MobileUser> {
  const user = await getMobileUser();

  if (!user) {
    throw unauthorized();
  }

  return user;
}

export async function requireRole(...roles: Role[]): Promise<MobileUser> {
  const user = await requireMobileUser();

  if (!roles.includes(user.role)) {
    throw forbidden();
  }

  return user;
}

export const requireAdmin = () => requireRole("ADMIN");
export const requireOwner = () => requireRole("OWNER");
export const requireStaff = () => requireRole("ADMIN", "TEACHER");
export const requireTeacher = () => requireRole("TEACHER");
export const requireStudent = () => requireRole("STUDENT");
export const requireParent = () => requireRole("PARENT");

export async function requireTeacherProfile(userId: string) {
  const teacher = await db.teacher.findUnique({
    where: { userId },
    select: { id: true, subject: true, bio: true },
  });

  if (!teacher) {
    throw forbidden();
  }

  return teacher;
}

export async function requireParentProfile(userId: string) {
  const parent = await db.parent.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!parent) {
    throw forbidden();
  }

  return parent;
}
