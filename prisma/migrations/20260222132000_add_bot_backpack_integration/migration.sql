CREATE TABLE "BotBackpackIntegration" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "lastRateLimitedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BotBackpackIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotBackpackIntegration_botId_key" ON "BotBackpackIntegration"("botId");

ALTER TABLE "BotBackpackIntegration"
ADD CONSTRAINT "BotBackpackIntegration_botId_fkey"
FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
