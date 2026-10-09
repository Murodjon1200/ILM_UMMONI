import { db } from "@/lib/db";

/**
 * Expo push delivery. Everything here is best-effort: a push failure must never
 * roll back the attendance, grade, badge or payment write that triggered it, and
 * a network error must never surface to the caller.
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_PER_REQUEST = 100;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

/** Sends to raw Expo tokens and prunes tokens Expo reports as unregistered. */
async function sendToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<number> {
  const unique = [...new Set(tokens.filter(Boolean))];

  if (unique.length === 0) {
    return 0;
  }

  let delivered = 0;
  const invalid: string[] = [];

  for (const batch of chunk(unique, MAX_PER_REQUEST)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        body: JSON.stringify(
          batch.map((to) => ({ to, sound: "default", ...payload })),
        ),
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const json = (await response.json()) as { data?: ExpoTicket[] };

      (json.data ?? []).forEach((ticket, index) => {
        if (ticket.status === "ok") {
          delivered += 1;
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          invalid.push(batch[index]);
        }
      });
    } catch {
      // Ignore: a single failed batch should not abort the rest.
    }
  }

  if (invalid.length > 0) {
    try {
      await db.expoPushToken.deleteMany({ where: { token: { in: invalid } } });
    } catch {
      // Ignore cleanup failures.
    }
  }

  return delivered;
}

export async function sendPushToUserIds(
  userIds: string[],
  payload: PushPayload,
): Promise<number> {
  const unique = [...new Set(userIds.filter(Boolean))];

  if (unique.length === 0) {
    return 0;
  }

  try {
    const rows = await db.expoPushToken.findMany({
      where: { userId: { in: unique } },
      select: { token: true },
    });

    return await sendToTokens(
      rows.map((row) => row.token),
      payload,
    );
  } catch {
    return 0;
  }
}

/** Push to the student's own device (e.g. a new grade or badge). */
export async function sendPushToStudent(
  studentId: string,
  payload: PushPayload,
): Promise<number> {
  try {
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });

    return student
      ? await sendPushToUserIds([student.userId], payload)
      : 0;
  } catch {
    return 0;
  }
}

/** Push to the parent(s) linked to a student (e.g. an absence). */
export async function sendPushToStudentParents(
  studentId: string,
  payload: PushPayload,
): Promise<number> {
  try {
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { parent: { select: { userId: true } } },
    });

    const parentUserId = student?.parent?.userId;

    return parentUserId ? await sendPushToUserIds([parentUserId], payload) : 0;
  } catch {
    return 0;
  }
}
