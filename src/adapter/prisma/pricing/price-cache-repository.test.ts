import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PrismaPriceCacheRepository } from "./price-cache-repository";

void test("findCachedPrice returns normalized cached quote when source matches", async () => {
  const prisma = {
    item: {
      findUnique: async () => ({
        priceSource: "backpack.tf",
        priceBestBuy: { currencies: { keys: 5, metal: 11 }, listingCount: 8 },
        priceBestSell: { currencies: { keys: 5, metal: 13 }, listingCount: 6 },
        priceCachedAt: new Date("2026-02-22T12:00:00.000Z"),
      }),
    },
  } as unknown as PrismaClient;

  const repository = new PrismaPriceCacheRepository(prisma);
  const cached = await repository.findCachedPrice({
    source: "backpack.tf",
    appId: 440,
    contextId: "2",
    sku: "5021;6",
  });

  assert.ok(cached);
  assert.equal(cached.bestBuy?.currencies.keys, 5);
  assert.equal(cached.bestSell?.listingCount, 6);
});

void test("saveCachedPrice upserts cache fields on item row", async () => {
  let capturedCreate: Record<string, unknown> | undefined;
  let capturedUpdate: Record<string, unknown> | undefined;
  const prisma = {
    item: {
      upsert: async (input: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        capturedCreate = input.create;
        capturedUpdate = input.update;
        return {};
      },
    },
  } as unknown as PrismaClient;

  const repository = new PrismaPriceCacheRepository(prisma);
  await repository.saveCachedPrice({
    source: "backpack.tf",
    appId: 440,
    contextId: "2",
    sku: "5021;6",
    bestBuy: { currencies: { keys: 5, metal: 11 }, listingCount: 8 },
    bestSell: { currencies: { keys: 5, metal: 13 }, listingCount: 6 },
    fetchedAt: new Date("2026-02-22T12:00:00.000Z"),
  });

  assert.equal(capturedCreate?.priceSource, "backpack.tf");
  assert.ok(capturedCreate?.priceCachedAt instanceof Date);
  assert.equal(capturedUpdate?.priceSource, "backpack.tf");
});
