import type { MarketPriceQuote } from "../type/price";

export type PriceQuery = {
  appId: number;
  contextId: string;
  sku: string;
  accessToken?: string;
};

export interface Pricer {
  readonly source: string;
  getPrice(query: PriceQuery): Promise<MarketPriceQuote>;
}
