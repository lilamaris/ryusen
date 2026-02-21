-- Drop old unused tables.
DROP TABLE IF EXISTS "inventory_items";
DROP TABLE IF EXISTS "steam_accounts";

-- Add cookie persistence for private inventory refresh.
ALTER TABLE "BotSession"
ADD COLUMN IF NOT EXISTS "webCookies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "BotSession"
ALTER COLUMN "webCookies" DROP DEFAULT;

-- Item catalog shared across bots.
CREATE TABLE "Item" (
  "id" TEXT NOT NULL,
  "appId" INTEGER NOT NULL,
  "contextId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "marketHashName" TEXT NOT NULL,
  "iconUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- Bot-item holdings snapshot.
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

CREATE UNIQUE INDEX "Item_appId_contextId_itemKey_key" ON "Item"("appId", "contextId", "itemKey");
CREATE INDEX "Item_itemKey_idx" ON "Item"("itemKey");

CREATE UNIQUE INDEX "BotHasItem_botId_itemId_key" ON "BotHasItem"("botId", "itemId");
CREATE INDEX "BotHasItem_itemId_idx" ON "BotHasItem"("itemId");

ALTER TABLE "BotHasItem"
ADD CONSTRAINT "BotHasItem_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BotHasItem"
ADD CONSTRAINT "BotHasItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
