-- CreateTable
CREATE TABLE "ListingPolicy" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "contextId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minMarginBps" INTEGER NOT NULL,
    "maxExposure" INTEGER NOT NULL,
    "targetBotName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingPolicy_enabled_source_idx" ON "ListingPolicy"("enabled", "source");

-- CreateIndex
CREATE UNIQUE INDEX "ListingPolicy_source_appId_contextId_sku_targetBotName_key" ON "ListingPolicy"("source", "appId", "contextId", "sku", "targetBotName");
