import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";

import { db } from "@/lib/db";
import { getTrustedClientIp } from "@/lib/ip";

interface HeaderSource {
  get(name: string): string | null;
}

export interface AuditRequestContext {
  ip: string | null;
  userAgent: string | null;
}

export interface AuditEntry {
  action: string;
  context?: AuditRequestContext;
  entity: string;
  entityId?: string | null;
  newValue?: Prisma.InputJsonValue;
  oldValue?: Prisma.InputJsonValue;
  userId?: string | null;
}

export function getRequestContext(
  source: HeaderSource = headers(),
): AuditRequestContext {
  return {
    ip: getTrustedClientIp(source),
    userAgent: source.get("user-agent")?.slice(0, 512) ?? null,
  };
}

export function createAuditLogData(
  entry: AuditEntry,
): Prisma.AuditLogUncheckedCreateInput {
  const context = entry.context ?? getRequestContext();

  return {
    userId: entry.userId ?? undefined,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? undefined,
    ip: context.ip,
    userAgent: context.userAgent,
    ...(entry.oldValue === undefined ? {} : { oldValue: entry.oldValue }),
    ...(entry.newValue === undefined ? {} : { newValue: entry.newValue }),
  };
}

export async function writeAuditLog(entry: AuditEntry) {
  return db.auditLog.create({
    data: createAuditLogData(entry),
  });
}
