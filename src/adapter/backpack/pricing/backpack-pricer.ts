import type { PriceQuery, Pricer } from "../../../core/pricing/interface/pricer";
import type { MarketPriceCurrencies, MarketPriceQuote, MarketSidePrice } from "../../../core/pricing/type/price";
import { debugLog } from "../../../debug";

type BackpackListingsSnapshotResponse = {
  listings?: BackpackListing[];
};

type BackpackListing = {
  intent?: number;
  currencies?: Record<string, unknown>;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseCurrencies(input: unknown): MarketPriceCurrencies | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const source = input as Record<string, unknown>;
  const keys = toNumber(source.keys ?? source.key);
  const metal = toNumber(source.metal ?? source.ref);
  const usd = toNumber(source.usd);

  if (keys === undefined && metal === undefined && usd === undefined) {
    return null;
  }

  return {
    ...(keys !== undefined ? { keys } : {}),
    ...(metal !== undefined ? { metal } : {}),
    ...(usd !== undefined ? { usd } : {}),
  };
}

function compareCurrencies(a: MarketPriceCurrencies, b: MarketPriceCurrencies): number {
  const keyDiff = (a.keys ?? 0) - (b.keys ?? 0);
  if (keyDiff !== 0) {
    return keyDiff;
  }

  const metalDiff = (a.metal ?? 0) - (b.metal ?? 0);
  if (metalDiff !== 0) {
    return metalDiff;
  }

  return (a.usd ?? 0) - (b.usd ?? 0);
}

function pickBest(listings: MarketPriceCurrencies[], direction: "buy" | "sell"): MarketSidePrice | null {
  if (listings.length === 0) {
    return null;
  }

  const sorted = [...listings].sort((a, b) => compareCurrencies(a, b));
  const best = direction === "buy" ? sorted[sorted.length - 1] : sorted[0];
  if (!best) {
    return null;
  }

  return {
    currencies: best,
    listingCount: listings.length,
  };
}

export class BackpackTfPricer implements Pricer {
  readonly source = "backpack.tf";

  async getPrice(query: PriceQuery): Promise<MarketPriceQuote> {
    if (!query.accessToken) {
      throw new Error("backpack.tf access token is required");
    }

    const url = new URL("https://backpack.tf/api/classifieds/listings/snapshot");
    url.searchParams.set("appid", String(query.appId));
    url.searchParams.set("sku", query.sku);

    debugLog("BackpackTfPricer", "getPrice:start", {
      source: this.source,
      appId: query.appId,
      contextId: query.contextId,
      sku: query.sku,
      url: url.toString(),
      hasAccessToken: Boolean(query.accessToken),
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Token ${query.accessToken}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      debugLog("BackpackTfPricer", "getPrice:httpError", {
        status: response.status,
        statusText: response.statusText,
        body,
      });
      throw new Error(`backpack.tf price request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as BackpackListingsSnapshotResponse;
    debugLog("BackpackTfPricer", "getPrice:response", {
      status: response.status,
      body,
    });
    const listings = body.listings ?? [];

    const buyListings: MarketPriceCurrencies[] = [];
    const sellListings: MarketPriceCurrencies[] = [];

    for (const listing of listings) {
      const currencies = parseCurrencies(listing.currencies);
      if (!currencies) {
        continue;
      }

      if (listing.intent === 0) {
        buyListings.push(currencies);
      } else if (listing.intent === 1) {
        sellListings.push(currencies);
      }
    }

    const quote = {
      source: this.source,
      appId: query.appId,
      contextId: query.contextId,
      sku: query.sku,
      bestBuy: pickBest(buyListings, "buy"),
      bestSell: pickBest(sellListings, "sell"),
      fetchedAt: new Date(),
    };

    debugLog("BackpackTfPricer", "getPrice:done", {
      source: this.source,
      sku: query.sku,
      buyListingCount: buyListings.length,
      sellListingCount: sellListings.length,
    });

    return quote;
  }
}
