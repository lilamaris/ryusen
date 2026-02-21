ALTER TABLE "Item"
ADD COLUMN "sku" TEXT NOT NULL DEFAULT '';

UPDATE "Item"
SET "sku" = CASE
  WHEN "itemKey" IS NOT NULL AND "itemKey" <> '' THEN CONCAT('raw-', "itemKey")
  ELSE CONCAT('raw-', "id")
END;

ALTER TABLE "Item"
ALTER COLUMN "sku" DROP DEFAULT;

DROP INDEX IF EXISTS "Item_appId_contextId_itemKey_key";
DROP INDEX IF EXISTS "Item_itemKey_idx";

CREATE UNIQUE INDEX "Item_appId_contextId_sku_key" ON "Item"("appId", "contextId", "sku");
CREATE INDEX "Item_sku_idx" ON "Item"("sku");
