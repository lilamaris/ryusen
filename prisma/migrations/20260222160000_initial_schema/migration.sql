-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BotOnboardingState" AS ENUM ('MANUAL_ONLY', 'AUTH_PENDING_CODE', 'ONBOARDING_LOCKED', 'AUTO_READY', 'FAILED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "contextId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketHashName" TEXT NOT NULL,
    "iconUrl" TEXT,
    "priceSource" TEXT,
    "priceBestBuy" JSONB,
    "priceBestSell" JSONB,
    "priceCachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotHasItem" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotHasItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "tradeToken" TEXT,
    "sharedSecret" TEXT,
    "identitySecret" TEXT,
    "revocationCode" TEXT,
    "onboardingState" "BotOnboardingState" NOT NULL DEFAULT 'MANUAL_ONLY',
    "onboardingStartedAt" TIMESTAMP(3),
    "tradeLockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotBackpackIntegration" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "lastRateLimitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotBackpackIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "webCookies" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_sku_idx" ON "Item"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Item_appId_contextId_sku_key" ON "Item"("appId", "contextId", "sku");

-- CreateIndex
CREATE INDEX "BotHasItem_itemId_idx" ON "BotHasItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "BotHasItem_botId_itemId_key" ON "BotHasItem"("botId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_name_key" ON "Bot"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_steamId_key" ON "Bot"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_accountName_key" ON "Bot"("accountName");

-- CreateIndex
CREATE UNIQUE INDEX "BotBackpackIntegration_botId_key" ON "BotBackpackIntegration"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_botId_key" ON "BotSession"("botId");

-- CreateIndex
CREATE INDEX "BotSession_expiresAt_idx" ON "BotSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "BotHasItem" ADD CONSTRAINT "BotHasItem_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotHasItem" ADD CONSTRAINT "BotHasItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotBackpackIntegration" ADD CONSTRAINT "BotBackpackIntegration_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

