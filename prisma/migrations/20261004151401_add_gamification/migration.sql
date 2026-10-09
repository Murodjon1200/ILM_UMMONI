-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "receiptNumber" SET DEFAULT gen_random_uuid()::text;

-- CreateTable
CREATE TABLE "XPLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStats" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XPLog_sourceKey_key" ON "XPLog"("sourceKey");

-- CreateIndex
CREATE INDEX "XPLog_studentId_createdAt_idx" ON "XPLog"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "XPLog_action_idx" ON "XPLog"("action");

-- CreateIndex
CREATE INDEX "Achievement_badge_idx" ON "Achievement"("badge");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_studentId_badge_key" ON "Achievement"("studentId", "badge");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStats_studentId_key" ON "StudentStats"("studentId");

-- AddForeignKey
ALTER TABLE "XPLog" ADD CONSTRAINT "XPLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStats" ADD CONSTRAINT "StudentStats_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
