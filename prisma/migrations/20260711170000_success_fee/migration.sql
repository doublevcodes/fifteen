-- CreateTable
CREATE TABLE "SuccessFee" (
    "id" TEXT NOT NULL,
    "delayEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "compensationAmountPence" INTEGER NOT NULL,
    "commissionPence" INTEGER NOT NULL,
    "charityPence" INTEGER NOT NULL,
    "totalFeePence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "molliePaymentId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccessFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuccessFee_delayEventId_key" ON "SuccessFee"("delayEventId");

-- CreateIndex
CREATE UNIQUE INDEX "SuccessFee_molliePaymentId_key" ON "SuccessFee"("molliePaymentId");

-- CreateIndex
CREATE INDEX "SuccessFee_userId_status_idx" ON "SuccessFee"("userId", "status");

-- CreateIndex
CREATE INDEX "SuccessFee_molliePaymentId_idx" ON "SuccessFee"("molliePaymentId");

-- AddForeignKey
ALTER TABLE "SuccessFee" ADD CONSTRAINT "SuccessFee_delayEventId_fkey" FOREIGN KEY ("delayEventId") REFERENCES "DelayEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessFee" ADD CONSTRAINT "SuccessFee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
