-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bot_name_key" ON "Bot"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_steamId_key" ON "Bot"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_accountName_key" ON "Bot"("accountName");

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_botId_key" ON "BotSession"("botId");

-- CreateIndex
CREATE INDEX "BotSession_expiresAt_idx" ON "BotSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
