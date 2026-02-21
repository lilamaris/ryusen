-- CreateTable
CREATE TABLE "inventory_items" (
    "id" BIGSERIAL NOT NULL,
    "steam_id64" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "raw_payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steam_accounts" (
    "user_id" TEXT NOT NULL,
    "steam_id64" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "steam_accounts_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "inventory_items_steam_id64_idx" ON "inventory_items"("steam_id64");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_steam_id64_item_key_key" ON "inventory_items"("steam_id64", "item_key");

-- CreateIndex
CREATE UNIQUE INDEX "steam_accounts_steam_id64_key" ON "steam_accounts"("steam_id64");
