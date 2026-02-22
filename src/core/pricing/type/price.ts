export type MarketPriceCurrencies = {
  keys?: number;
  metal?: number;
  usd?: number;
};

export type MarketSidePrice = {
  currencies: MarketPriceCurrencies;
  listingCount: number;
};

export type MarketPriceQuote = {
  source: string;
  appId: number;
  contextId: string;
  sku: string;
  bestBuy: MarketSidePrice | null;
  bestSell: MarketSidePrice | null;
  fetchedAt: Date;
};
