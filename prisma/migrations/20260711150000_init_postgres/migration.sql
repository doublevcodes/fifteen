-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "payoutPreference" TEXT NOT NULL DEFAULT 'bank',
    "defaultTicketType" TEXT NOT NULL DEFAULT 'contactless',
    "autoSubmitConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "portalEmail" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TflCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portalEmail" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TflCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelayEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "originCrs" TEXT NOT NULL,
    "originName" TEXT NOT NULL,
    "destinationCrs" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "serviceUid" TEXT NOT NULL,
    "runDate" TEXT NOT NULL,
    "scheduledArrival" TEXT NOT NULL,
    "actualArrival" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "ticketType" TEXT NOT NULL,
    "ticketPricePence" INTEGER NOT NULL,
    "compensationTier" TEXT NOT NULL,
    "compensationAmountPence" INTEGER NOT NULL,
    "claimSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unclaimed',
    "workflowRunId" TEXT,
    "portalClaimRef" TEXT,
    "submitError" TEXT,
    "submittedAt" TIMESTAMP(3),
    "evidencePath" TEXT,
    "evidenceMime" TEXT,
    "tflJourneyId" TEXT,
    "contactlessFarePence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DelayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimProfile_userId_key" ON "ClaimProfile"("userId");

-- CreateIndex
CREATE INDEX "OperatorCredential_userId_idx" ON "OperatorCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorCredential_userId_operator_key" ON "OperatorCredential"("userId", "operator");

-- CreateIndex
CREATE UNIQUE INDEX "TflCredential_userId_key" ON "TflCredential"("userId");

-- CreateIndex
CREATE INDEX "DelayEvent_userId_status_idx" ON "DelayEvent"("userId", "status");

-- CreateIndex
CREATE INDEX "DelayEvent_userId_createdAt_idx" ON "DelayEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DelayEvent_userId_serviceUid_runDate_key" ON "DelayEvent"("userId", "serviceUid", "runDate");

-- AddForeignKey
ALTER TABLE "ClaimProfile" ADD CONSTRAINT "ClaimProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorCredential" ADD CONSTRAINT "OperatorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TflCredential" ADD CONSTRAINT "TflCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayEvent" ADD CONSTRAINT "DelayEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
