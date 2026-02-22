import assert from "node:assert/strict";
import test from "node:test";
import type { CachedMarketPriceQuote, PriceCacheRepository } from "../interface/price-cache-repository";
import type { PriceQuery, Pricer } from "../interface/pricer";
import type { MarketPriceQuote } from "../type/price";
import { MarketPriceService } from "./price";

class FakePricer implements Pricer {
  callCount = 0;

  constructor(
    readonly source: string,
    private readonly output: Omit<MarketPriceQuote, "source" | "appId" | "contextId" | "sku">
  ) {}

  getPrice(query: PriceQuery): Promise<MarketPriceQuote> {
    this.callCount += 1;
    return Promise.resolve({
      source: this.source,
      appId: query.appId,
      contextId: query.contextId,
      sku: query.sku,
      ...this.output,
    });
  }
}

class FakePriceCacheRepository implements PriceCacheRepository {
  constructor(private readonly cached: CachedMarketPriceQuote | null = null) {}

  saved: MarketPriceQuote[] = [];

  findCachedPrice(_input: {
    source: string;
    appId: number;
    contextId: string;
    sku: string;
  }): Promise<CachedMarketPriceQuote | null> {
    return Promise.resolve(this.cached);
  }

  saveCachedPrice(input: MarketPriceQuote): Promise<void> {
    this.saved.push(input);
    return Promise.resolve();
  }
}

void test("getPrice returns cached quote when within max age", async () => {
  const cache = new FakePriceCacheRepository({
    source: "backpack.tf",
    appId: 440,
    contextId: "2",
    sku: "5021;6",
    bestBuy: { currencies: { keys: 4, metal: 10 }, listingCount: 2 },
    bestSell: { currencies: { keys: 4, metal: 12 }, listingCount: 3 },
    cachedAt: new Date(),
  });
  const pricer = new FakePricer("backpack.tf", {
    bestBuy: { currencies: { keys: 5 }, listingCount: 1 },
    bestSell: { currencies: { keys: 6 }, listingCount: 1 },
    fetchedAt: new Date("2026-02-22T00:00:00.000Z"),
  });
  const service = new MarketPriceService([pricer], cache);

  const quote = await service.getPrice({
    source: "backpack.tf",
    appId: 440,
    contextId: "2",
    sku: "5021;6",
  });

  assert.equal(pricer.callCount, 0);
  assert.equal(quote.source, "backpack.tf");
  assert.equal(quote.bestBuy?.currencies.keys, 4);
  assert.equal(quote.bestSell?.currencies.metal, 12);
  assert.equal(cache.saved.length, 0);
});

void test("getPrice refreshes and stores when cache is stale", async () => {
  const staleAt = new Date(Date.now() - 300_000);
  const cache = new FakePriceCacheRepository({
    source: "backpack.tf",
    appId: 440,
    contextId: "2",
    sku: "5021;6",
    bestBuy: { currencies: { keys: 1 }, listingCount: 1 },
    bestSell: { currencies: { keys: 2 }, listingCount: 1 },
    cachedAt: staleAt,
  });
  const pricer = new FakePricer("backpack.tf", {
    bestBuy: { currencies: { keys: 4, metal: 10 }, listingCount: 2 },
    bestSell: { currencies: { keys: 4, metal: 12 }, listingCount: 3 },
    fetchedAt: new Date("2026-02-22T00:00:00.000Z"),
  });
  const service = new MarketPriceService([pricer], cache);

  const quote = await service.getPrice({
    source: "backpack.tf",
    appId: 440,
    contextId: "2",
    sku: "5021;6",
    maxAgeSeconds: 60,
  });

  assert.equal(pricer.callCount, 1);
  assert.equal(quote.bestBuy?.currencies.keys, 4);
  assert.equal(cache.saved.length, 1);
});

void test("getPrice throws when source is not registered", async () => {
  const service = new MarketPriceService([], new FakePriceCacheRepository());

  await assert.rejects(
    () =>
      service.getPrice({
        source: "unknown",
        appId: 440,
        contextId: "2",
        sku: "5021;6",
      }),
    /Unsupported price source/
  );
});
