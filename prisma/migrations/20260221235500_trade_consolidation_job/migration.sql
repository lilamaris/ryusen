CREATE TYPE "TradeConsolidationJobStatus" AS ENUM ('PLANNED', 'COMPLETED', 'FAILED');
CREATE TYPE "TradeConsolidationLegStatus" AS ENUM ('PLANNED', 'COMPLETED', 'FAILED');

CREATE TABLE "TradeConsolidationJob" (
  "id" TEXT NOT NULL,
  "controlBotId" TEXT NOT NULL,
  "appId" INTEGER NOT NULL,
  "contextId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "requestedAmount" INTEGER NOT NULL,
  "status" "TradeConsolidationJobStatus" NOT NULL,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TradeConsolidationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeConsolidationLeg" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "fromBotId" TEXT NOT NULL,
  "toBotId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "TradeConsolidationLegStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TradeConsolidationLeg_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradeConsolidationJob_status_idx" ON "TradeConsolidationJob"("status");
CREATE INDEX "TradeConsolidationJob_sku_idx" ON "TradeConsolidationJob"("sku");
CREATE INDEX "TradeConsolidationJob_controlBotId_idx" ON "TradeConsolidationJob"("controlBotId");
CREATE INDEX "TradeConsolidationLeg_jobId_idx" ON "TradeConsolidationLeg"("jobId");
CREATE INDEX "TradeConsolidationLeg_fromBotId_idx" ON "TradeConsolidationLeg"("fromBotId");
CREATE INDEX "TradeConsolidationLeg_toBotId_idx" ON "TradeConsolidationLeg"("toBotId");

ALTER TABLE "TradeConsolidationJob"
ADD CONSTRAINT "TradeConsolidationJob_controlBotId_fkey" FOREIGN KEY ("controlBotId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeConsolidationLeg"
ADD CONSTRAINT "TradeConsolidationLeg_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TradeConsolidationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeConsolidationLeg"
ADD CONSTRAINT "TradeConsolidationLeg_fromBotId_fkey" FOREIGN KEY ("fromBotId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeConsolidationLeg"
ADD CONSTRAINT "TradeConsolidationLeg_toBotId_fkey" FOREIGN KEY ("toBotId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
