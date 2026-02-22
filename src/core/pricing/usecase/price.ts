import type { Pricer } from "../interface/pricer";
import type { PriceCacheRepository } from "../interface/price-cache-repository";
import type { MarketPriceQuote } from "../type/price";
import type { DebugLogger } from "../../shared/type/debug-logger";

const DEFAULT_PRICE_CACHE_TTL_SECONDS = 120;

export class MarketPriceService {
  private readonly pricersBySource: Map<string, Pricer>;

  constructor(
    pricers: Pricer[],
    private readonly priceCacheRepository: PriceCacheRepository,
    private readonly debugLogger?: DebugLogger
  ) {
    this.pricersBySource = new Map(pricers.map((pricer) => [pricer.source, pricer]));
  }

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("MarketPriceService", message, meta);
  }

  async getPrice(input: {
    source: string;
    appId: number;
    contextId: string;
    sku: string;
    accessToken?: string;
    maxAgeSeconds?: number;
  }): Promise<MarketPriceQuote> {
    this.debug("getPrice:start", input);
    const maxAgeSeconds = input.maxAgeSeconds ?? DEFAULT_PRICE_CACHE_TTL_SECONDS;
    if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 0) {
      throw new Error("maxAgeSeconds must be a non-negative number");
    }

    const pricer = this.pricersBySource.get(input.source);
    if (!pricer) {
      throw new Error(`Unsupported price source: ${input.source}`);
    }

    const cache = await this.priceCacheRepository.findCachedPrice({
      source: input.source,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
    });
    const now = Date.now();
    const maxAgeMs = maxAgeSeconds * 1000;
    if (cache && now - cache.cachedAt.getTime() <= maxAgeMs) {
      const cachedQuote = {
        source: cache.source,
        appId: cache.appId,
        contextId: cache.contextId,
        sku: cache.sku,
        bestBuy: cache.bestBuy,
        bestSell: cache.bestSell,
        fetchedAt: cache.cachedAt,
      };

      this.debug("getPrice:cacheHit", {
        source: cache.source,
        sku: cache.sku,
        cachedAt: cache.cachedAt.toISOString(),
        maxAgeSeconds,
      });

      return cachedQuote;
    }

    const quote = await pricer.getPrice({
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      ...(input.accessToken ? { accessToken: input.accessToken } : {}),
    });
    await this.priceCacheRepository.saveCachedPrice(quote);

    this.debug("getPrice:done", {
      source: quote.source,
      sku: quote.sku,
      hasBestBuy: Boolean(quote.bestBuy),
      hasBestSell: Boolean(quote.bestSell),
      cacheMiss: true,
    });

    return quote;
  }
}
