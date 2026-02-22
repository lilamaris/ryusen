import assert from "node:assert/strict";
import test from "node:test";
import type { BotInventoryRepository } from "../interface/inventory-repository";
import type { BotItemHolder, BotSkuHolding } from "../type/holding";
import { ClusterStockService } from "./stock";

class FakeInventoryRepository implements BotInventoryRepository {
  constructor(private readonly holdings: BotSkuHolding[]) {}

  replaceBotHoldings(): Promise<void> {
    return Promise.reject(new Error("not used"));
  }

  listBotsBySku(): Promise<BotItemHolder[]> {
    return Promise.reject(new Error("not used"));
  }

  listBotSkuHoldings(): Promise<BotSkuHolding[]> {
    return Promise.resolve(this.holdings);
  }
}

void test("getStock returns total amount and holder rows", async () => {
  const service = new ClusterStockService(
    new FakeInventoryRepository([
      {
        botId: "b1",
        botName: "alpha",
        steamId: "111",
        amount: 2,
        lastSeenAt: new Date("2026-02-21T00:00:00.000Z"),
      },
      {
        botId: "b2",
        botName: "beta",
        steamId: "222",
        amount: 3,
        lastSeenAt: new Date("2026-02-21T00:00:00.000Z"),
      },
    ])
  );

  const result = await service.getStock({
    appId: 440,
    contextId: "2",
    sku: "5500",
  });

  assert.equal(result.totalAmount, 5);
  assert.equal(result.holders.length, 2);
  assert.equal(result.holders[0]?.botName, "alpha");
});
