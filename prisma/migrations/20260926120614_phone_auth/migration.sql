WITH numbered_users AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "id") AS row_number
  FROM "User"
)
UPDATE "User"
SET "phone" = '998' || LPAD(row_number::text, 9, '0')
FROM numbered_users
WHERE "User"."id" = numbered_users."id";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "receiptNumber" SET DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
