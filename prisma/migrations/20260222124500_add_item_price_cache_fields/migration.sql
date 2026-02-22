-- Actual price-cache schema migration.
-- Note: `20260222052957_add_item_price_cache_fields` is a historical no-op placeholder.
ALTER TABLE "Item"
  ADD COLUMN "priceSource" TEXT,
  ADD COLUMN "priceBestBuy" JSONB,
  ADD COLUMN "priceBestSell" JSONB,
  ADD COLUMN "priceCachedAt" TIMESTAMP(3);

CREATE INDEX "Item_priceSource_priceCachedAt_idx" ON "Item"("priceSource", "priceCachedAt");
