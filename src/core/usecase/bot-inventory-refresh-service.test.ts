import test from "node:test";
import assert from "node:assert/strict";
import { BotInventoryRefreshService } from "./bot-inventory-refresh-service";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { Bot, BotSession } from "../bot/bot-session";
import type {
  AuthenticatedInventoryItem,
  AuthenticatedInventoryProvider,
  AuthenticatedInventoryQuery,
} from "../port/authenticated-inventory-provider";
import type { BotInventoryRepository, BotInventoryWriteItem } from "../port/bot-inventory-repository";

class FakeSessionRepository implements BotSessionRepository {
  constructor(private readonly rows: Array<{ bot: Bot; session: BotSession | null }>) {}

  createBot(): Promise<Bot> {
    return Promise.reject(new Error("not used"));
  }

  findBotByName(): Promise<Bot | null> {
    return Promise.reject(new Error("not used"));
  }

  listBots(): Promise<Bot[]> {
    return Promise.reject(new Error("not used"));
  }

  listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
    return Promise.resolve(this.rows);
  }

  upsertSession(): Promise<BotSession> {
    return Promise.reject(new Error("not used"));
  }

  findSessionByBotId(): Promise<BotSession | null> {
    return Promise.reject(new Error("not used"));
  }

  markSessionChecked(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeInventoryProvider implements AuthenticatedInventoryProvider {
  public calls: AuthenticatedInventoryQuery[] = [];

  listItems(query: AuthenticatedInventoryQuery): Promise<AuthenticatedInventoryItem[]> {
    this.calls.push(query);
    if (query.steamId === "steam-fail") {
      return Promise.reject(new Error("inventory fetch failed"));
    }

    return Promise.resolve([
      {
        sku: "5021",
        itemKey: "111_222",
        name: "Mann Co. Supply Crate Key",
        marketHashName: "Mann Co. Supply Crate Key",
        quantity: 2,
        rawPayload: { source: query.steamId },
      },
    ]);
  }
}

class FakeBotInventoryRepository implements BotInventoryRepository {
  public writes: Array<{
    botId: string;
    appId: number;
    contextId: string;
    items: BotInventoryWriteItem[];
  }> = [];

  replaceBotHoldings(
    botId: string,
    appId: number,
    contextId: string,
    items: BotInventoryWriteItem[]
  ): Promise<void> {
    this.writes.push({ botId, appId, contextId, items });
    return Promise.resolve();
  }

  listBotsBySku(): Promise<Array<{ botName: string; steamId: string; amount: number; lastSeenAt: Date }>> {
    return Promise.resolve([]);
  }
}

void test("refreshAll updates only valid sessions and records failures", async () => {
  const now = new Date("2026-02-21T12:00:00.000Z");
  const sessions = new FakeSessionRepository([
    {
      bot: { id: "b1", name: "ok", steamId: "steam-ok", accountName: "ok_acc" },
      session: {
        botId: "b1",
        sessionToken: "token",
        webCookies: ["sessionid=a"],
        expiresAt: new Date("2026-02-21T13:00:00.000Z"),
        lastCheckedAt: null,
      },
    },
    {
      bot: { id: "b2", name: "expired", steamId: "steam-exp", accountName: "exp_acc" },
      session: {
        botId: "b2",
        sessionToken: "token",
        webCookies: ["sessionid=b"],
        expiresAt: new Date("2026-02-21T11:00:00.000Z"),
        lastCheckedAt: null,
      },
    },
    {
      bot: { id: "b3", name: "missing-cookie", steamId: "steam-no-cookie", accountName: "nocookie_acc" },
      session: {
        botId: "b3",
        sessionToken: "token",
        webCookies: [],
        expiresAt: new Date("2026-02-21T13:00:00.000Z"),
        lastCheckedAt: null,
      },
    },
    {
      bot: { id: "b4", name: "fail", steamId: "steam-fail", accountName: "fail_acc" },
      session: {
        botId: "b4",
        sessionToken: "token",
        webCookies: ["sessionid=d"],
        expiresAt: new Date("2026-02-21T13:00:00.000Z"),
        lastCheckedAt: null,
      },
    },
  ]);

  const inventoryProvider = new FakeInventoryProvider();
  const inventoryRepository = new FakeBotInventoryRepository();

  const service = new BotInventoryRefreshService(sessions, inventoryProvider, inventoryRepository);
  const result = await service.refreshAll({ appId: 440, contextId: "2", now });

  assert.deepEqual(result, {
    totalBots: 4,
    updatedBots: 1,
    skippedBots: 2,
    failedBots: 1,
    errors: [{ botName: "fail", reason: "inventory fetch failed" }],
  });

  assert.deepEqual(
    inventoryProvider.calls.map((call) => call.steamId),
    ["steam-ok", "steam-fail"]
  );

  assert.equal(inventoryRepository.writes.length, 1);
  assert.equal(inventoryRepository.writes[0]?.botId, "b1");
  assert.equal(inventoryRepository.writes[0]?.items[0]?.lastSeenAt.toISOString(), now.toISOString());
});
