-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "receiptNumber" SET DEFAULT gen_random_uuid()::text;

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "Payment_date_idx" ON "Payment"("date");
