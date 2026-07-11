-- AlterTable
ALTER TABLE "ClaimProfile" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;
ALTER TABLE "ClaimProfile" ADD COLUMN IF NOT EXISTS "bankSortCode" TEXT;
ALTER TABLE "ClaimProfile" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "ClaimProfile" ADD COLUMN IF NOT EXISTS "mollieCustomerId" TEXT;
ALTER TABLE "ClaimProfile" ADD COLUMN IF NOT EXISTS "bankConnectedAt" TIMESTAMP(3);

-- AlterTable SuccessFee for receive-then-payout
ALTER TABLE "SuccessFee" ADD COLUMN IF NOT EXISTS "userPayoutPence" INTEGER NOT NULL DEFAULT 0;

-- Migrate legacy charge statuses toward payout statuses
UPDATE "SuccessFee" SET "status" = 'awaiting_funds' WHERE "status" IN ('pending', 'open');
UPDATE "SuccessFee" SET "status" = 'paid_out' WHERE "status" = 'paid';
UPDATE "SuccessFee" SET "userPayoutPence" = "compensationAmountPence" - "totalFeePence" WHERE "userPayoutPence" = 0 AND "compensationAmountPence" > 0;
