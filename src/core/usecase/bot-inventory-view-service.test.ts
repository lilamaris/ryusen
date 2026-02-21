import assert from "node:assert/strict";
import test from "node:test";
import type { InventoryItem, InventoryProvider, InventoryQuery } from "../provider/inventory-provider";
import type { ResolveInventoryTargetsResult } from "./bot-inventory-query-service";
import { BotInventoryViewService } from "./bot-inventory-view-service";

class FakeTargetResolver {
  public byNameResult: ResolveInventoryTargetsResult = { targets: [], skipped: [] };
  public allResult: ResolveInventoryTargetsResult = { targets: [], skipped: [] };

  resolveByBotName(): Promise<ResolveInventoryTargetsResult> {
    return Promise.resolve(this.byNameResult);
  }

  resolveAllBots(): Promise<ResolveInventoryTargetsResult> {
    return Promise.resolve(this.allResult);
  }
}

class FakeProvider implements InventoryProvider<InventoryQuery> {
  public responses = new Map<string, InventoryItem[]>();
  public failureSteamIds = new Set<string>();

  listItems(query: InventoryQuery): Promise<InventoryItem[]> {
    if (this.failureSteamIds.has(query.steamId)) {
      return Promise.reject(new Error(`failed:${query.steamId}`));
    }
    return Promise.resolve(this.responses.get(query.steamId) ?? []);
  }
}

void test("fetchBySelection validates name/all selection", async () => {
  const resolver = new FakeTargetResolver();
  const provider = new FakeProvider();
  const service = new BotInventoryViewService(resolver, provider);

  await assert.rejects(
    service.fetchBySelection({
      botName: "bot-a",
      all: true,
      appId: 730,
      contextId: "2",
      allowPublicFallback: false,
    }),
    /Use either --name or --all/
  );

  await assert.rejects(
    service.fetchBySelection({
      appId: 730,
      contextId: "2",
      allowPublicFallback: false,
    }),
    /One of --name or --all is required/
  );
});

void test("fetchBySelection returns inventories, skipped, and failures", async () => {
  const resolver = new FakeTargetResolver();
  resolver.allResult = {
    targets: [
      {
        botName: "bot-a",
        query: { steamId: "100", appId: 730, contextId: "2" },
      },
      {
        botName: "bot-b",
        query: { steamId: "200", appId: 730, contextId: "2" },
      },
    ],
    skipped: [{ botName: "bot-c", reason: "no_session" }],
  };

  const provider = new FakeProvider();
  provider.responses.set("100", [
    {
      key: "1",
      itemKey: "1",
      sku: "100;6",
      name: "Alpha",
      marketHashName: "Alpha",
      quantity: 3,
      rawPayload: {},
    },
  ]);
  provider.failureSteamIds.add("200");

  const service = new BotInventoryViewService(resolver, provider);
  const result = await service.fetchBySelection({
    all: true,
    appId: 730,
    contextId: "2",
    allowPublicFallback: false,
  });

  assert.deepEqual(result.skipped, [{ botName: "bot-c", reason: "no_session" }]);
  assert.equal(result.inventories.length, 1);
  assert.equal(result.inventories[0]?.botName, "bot-a");
  assert.deepEqual(result.failures, [{ botName: "bot-b", reason: "failed:200" }]);
});
