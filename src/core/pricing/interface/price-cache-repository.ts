import type { MarketPriceQuote, MarketSidePrice } from "../type/price";

export type CachedMarketPriceQuote = {
  source: string;
  appId: number;
  contextId: string;
  sku: string;
  bestBuy: MarketSidePrice | null;
  bestSell: MarketSidePrice | null;
  cachedAt: Date;
};

export interface PriceCacheRepository {
  findCachedPrice(input: {
    source: string;
    appId: number;
    contextId: string;
    sku: string;
  }): Promise<CachedMarketPriceQuote | null>;
  saveCachedPrice(input: MarketPriceQuote): Promise<void>;
}
