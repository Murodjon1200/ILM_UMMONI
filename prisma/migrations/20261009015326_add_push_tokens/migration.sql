-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "receiptNumber" SET DEFAULT gen_random_uuid()::text;

-- CreateTable
CREATE TABLE "ExpoPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpoPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpoPushToken_token_key" ON "ExpoPushToken"("token");

-- CreateIndex
CREATE INDEX "ExpoPushToken_userId_idx" ON "ExpoPushToken"("userId");

-- AddForeignKey
ALTER TABLE "ExpoPushToken" ADD CONSTRAINT "ExpoPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
