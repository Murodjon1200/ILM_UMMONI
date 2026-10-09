import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { auth } from "@/auth";
import { formatSom } from "@/lib/currency";
import { db } from "@/lib/db";
import { formatReadableDate } from "@/lib/date";
import { withApiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Receipt numbers are generated as RCP-YYYYMMDD-<hex>, but historical rows use
 *  a raw uuid default, so accept both shapes and bound the length. */
const receiptNumberSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, "Invalid receipt number.");

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

async function buildReceipt(receiptNumber: string) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.user.role !== "STUDENT") {
    return Response.json({ error: "Access denied." }, { status: 403 });
  }

  const parsedReceipt = receiptNumberSchema.safeParse(receiptNumber);

  if (!parsedReceipt.success) {
    return Response.json({ error: "Receipt not found." }, { status: 404 });
  }

  const payment = await db.payment.findUnique({
    where: { receiptNumber: parsedReceipt.data },
    include: {
      student: {
        select: {
          userId: true,
          course: { select: { name: true } },
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!payment || payment.student.userId !== session.user.id) {
    return Response.json({ error: "Receipt not found." }, { status: 404 });
  }

  try {
    await writeAuditLog({
      userId: session.user.id,
      action: "PAYMENT_RECEIPT_DOWNLOAD",
      entity: "Payment",
      entityId: payment.id,
      newValue: { receiptNumber: payment.receiptNumber },
    });
  } catch {
    return Response.json({ error: "Receipt could not be generated." }, { status: 500 });
  }

  const receiptHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Receipt ${escapeHtml(payment.receiptNumber)}</title>
<style>
body{font-family:Arial,sans-serif;color:#0f172a;margin:0;padding:40px;background:#f8fafc}
.receipt{max-width:640px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:36px}
h1{margin:0;color:#0052A3;font-size:24px;letter-spacing:.08em}
.meta{color:#64748b;margin-top:8px}
.row{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #e2e8f0;padding:16px 0}
.label{color:#64748b;font-size:13px}
.value{font-weight:600;text-align:right}
.total{font-size:22px;color:#0052A3}
@media print{body{background:#fff;padding:0}.receipt{border:0}}
</style>
</head>
<body>
<main class="receipt">
<h1>ILM UMMONI</h1>
<p class="meta">Official payment receipt</p>
<div class="row"><span class="label">Receipt number</span><span class="value">${escapeHtml(payment.receiptNumber)}</span></div>
<div class="row"><span class="label">Student</span><span class="value">${escapeHtml(payment.student.user.name)}</span></div>
<div class="row"><span class="label">Course</span><span class="value">${escapeHtml(payment.student.course.name)}</span></div>
<div class="row"><span class="label">Payment date</span><span class="value">${escapeHtml(formatReadableDate(payment.date))}</span></div>
<div class="row"><span class="label">Method</span><span class="value">${escapeHtml(payment.method.replaceAll("_", " "))}</span></div>
<div class="row"><span class="label">Status</span><span class="value">${escapeHtml(payment.status)}</span></div>
<div class="row"><span class="label">Amount</span><span class="value total">${escapeHtml(formatSom(Number(payment.amount)))}</span></div>
</main>
</body>
</html>`;

  const safeReceiptFileName = payment.receiptNumber.replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );

  return new Response(receiptHtml, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="receipt-${safeReceiptFileName}.html"`,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { receiptNumber: string } },
) {
  return withApiRateLimit(request, () => buildReceipt(params.receiptNumber));
}
