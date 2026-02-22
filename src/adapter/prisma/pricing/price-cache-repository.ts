import { Prisma, PrismaClient } from "@prisma/client";
import type { PriceCacheRepository } from "../../../core/pricing/interface/price-cache-repository";
import type { MarketPriceQuote, MarketSidePrice } from "../../../core/pricing/type/price";

type PriceJsonRecord = Record<string, unknown>;

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function parseSidePrice(value: Prisma.JsonValue | null): MarketSidePrice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as PriceJsonRecord;
  const currenciesRaw = record.currencies;
  if (!currenciesRaw || typeof currenciesRaw !== "object" || Array.isArray(currenciesRaw)) {
    return null;
  }

  const currencies = currenciesRaw as PriceJsonRecord;
  const listingCount = parseNumber(record.listingCount);
  if (listingCount === undefined) {
    return null;
  }

  const keys = parseNumber(currencies.keys);
  const metal = parseNumber(currencies.metal);
  const usd = parseNumber(currencies.usd);

  return {
    currencies: {
      ...(keys !== undefined ? { keys } : {}),
      ...(metal !== undefined ? { metal } : {}),
      ...(usd !== undefined ? { usd } : {}),
    },
    listingCount,
  };
}

function toJson(value: MarketSidePrice | null): Prisma.InputJsonValue {
  if (!value) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  return value as Prisma.InputJsonValue;
}

export class PrismaPriceCacheRepository implements PriceCacheRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCachedPrice(input: {
    source: string;
    appId: number;
    contextId: string;
    sku: string;
  }) {
    const row = await this.prisma.item.findUnique({
      where: {
        appId_contextId_sku: {
          appId: input.appId,
          contextId: input.contextId,
          sku: input.sku,
        },
      },
      select: {
        priceSource: true,
        priceBestBuy: true,
        priceBestSell: true,
        priceCachedAt: true,
      },
    });

    if (!row || !row.priceSource || !row.priceCachedAt) {
      return null;
    }

    if (row.priceSource !== input.source) {
      return null;
    }

    return {
      source: row.priceSource,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      bestBuy: parseSidePrice(row.priceBestBuy),
      bestSell: parseSidePrice(row.priceBestSell),
      cachedAt: row.priceCachedAt,
    };
  }

  async saveCachedPrice(input: MarketPriceQuote): Promise<void> {
    await this.prisma.item.upsert({
      where: {
        appId_contextId_sku: {
          appId: input.appId,
          contextId: input.contextId,
          sku: input.sku,
        },
      },
      create: {
        appId: input.appId,
        contextId: input.contextId,
        sku: input.sku,
        itemKey: input.sku,
        name: input.sku,
        marketHashName: input.sku,
        iconUrl: null,
        priceSource: input.source,
        priceBestBuy: toJson(input.bestBuy),
        priceBestSell: toJson(input.bestSell),
        priceCachedAt: input.fetchedAt,
      },
      update: {
        priceSource: input.source,
        priceBestBuy: toJson(input.bestBuy),
        priceBestSell: toJson(input.bestSell),
        priceCachedAt: input.fetchedAt,
      },
    });
  }
}
