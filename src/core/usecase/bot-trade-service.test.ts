import assert from "node:assert/strict";
import test from "node:test";
import type { Bot, BotSession } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { InventoryProvider, InventoryQuery, InventoryItem } from "../provider/inventory-provider";
import type { BotTradeOfferGateway, TradeOfferAsset } from "../port/bot-trade-offer-gateway";
import { BotTradeService } from "./bot-trade-service";

class FakeBotSessionRepository implements BotSessionRepository {
  constructor(
    private readonly bots: Bot[],
    private readonly sessions: Map<string, BotSession | null> = new Map()
  ) {}

  createBot(): Promise<Bot> {
    return Promise.reject(new Error("not implemented"));
  }

  findBotByName(name: string): Promise<Bot | null> {
    return Promise.resolve(this.bots.find((bot) => bot.name === name) ?? null);
  }

  findBotBySteamId(steamId: string): Promise<Bot | null> {
    return Promise.resolve(this.bots.find((bot) => bot.steamId === steamId) ?? null);
  }

  updateBotIdentity(input: { botId: string; name: string; accountName: string }): Promise<Bot> {
    const bot = this.bots.find((item) => item.id === input.botId);
    if (!bot) {
      return Promise.reject(new Error("not implemented"));
    }
    bot.name = input.name;
    bot.accountName = input.accountName;
    return Promise.resolve(bot);
  }

  listBots(): Promise<Bot[]> {
    return Promise.resolve(this.bots);
  }

  listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
    return Promise.resolve(this.bots.map((bot) => ({ bot, session: this.sessions.get(bot.id) ?? null })));
  }

  upsertSession(): Promise<BotSession> {
    return Promise.reject(new Error("not implemented"));
  }

  findSessionByBotId(botId: string): Promise<BotSession | null> {
    return Promise.resolve(this.sessions.get(botId) ?? null);
  }

  markSessionChecked(): Promise<void> {
    return Promise.resolve();
  }

  setBotTradeToken(): Promise<Bot> {
    return Promise.reject(new Error("not implemented"));
  }

  setBotTradeSecretsBySteamId(): Promise<Bot> {
    return Promise.reject(new Error("not implemented"));
  }

  setBotOnboardingState(): Promise<Bot> {
    return Promise.reject(new Error("not implemented"));
  }
}

class FakeInventoryProvider implements InventoryProvider<InventoryQuery> {
  constructor(private readonly inventories: Map<string, InventoryItem[]>) {}

  listItems(query: InventoryQuery): Promise<InventoryItem[]> {
    const key = `${query.steamId}:${query.appId}:${query.contextId}`;
    return Promise.resolve(this.inventories.get(key) ?? []);
  }
}

class FakeTradeOfferGateway implements BotTradeOfferGateway {
  public lastAssets: TradeOfferAsset[] | null = null;
  public lastPartnerTradeToken: string | null = null;

  async createTradeOffer(input: {
    partnerSteamId: string;
    partnerTradeToken?: string;
    sessionId: string;
    webCookies: string[];
    assets: TradeOfferAsset[];
    message?: string;
  }): Promise<{ tradeOfferId: string; offerUrl: string }> {
    this.lastAssets = input.assets;
    this.lastPartnerTradeToken = input.partnerTradeToken ?? null;
    return {
      tradeOfferId: "offer-123",
      offerUrl: "https://example.com/tradeoffer/offer-123",
    };
  }
}

function createInventoryItem(sku: string, assetId: string, amount: number): InventoryItem {
  return {
    key: `${sku}-${assetId}`,
    itemKey: `${sku}-${assetId}`,
    sku,
    name: "Test Item",
    marketHashName: "Test Item",
    quantity: amount,
    rawPayload: {
      assets: [
        {
          assetId,
          classId: "1",
          instanceId: "0",
          amount,
        },
      ],
      description: null,
    },
  };
}

void test("createOffer builds trade offer from assets", async () => {
  const bots: Bot[] = [
    {
      id: "from",
      name: "from-bot",
      steamId: "1",
      accountName: "from-account",
      tradeToken: null,
      sharedSecret: "shared",
      onboardingState: "AUTO_READY",
    },
    { id: "to", name: "to-bot", steamId: "2", accountName: "to-account", tradeToken: null },
  ];
  const session: BotSession = {
    botId: "from",
    sessionToken: "sessionid",
    webCookies: ["sessionid=sessionid", "steamLogin=token"],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    lastCheckedAt: null,
  };
  const repository = new FakeBotSessionRepository(bots, new Map([["from", session]]));
  const provider = new FakeInventoryProvider(
    new Map([["1:440:2", [createInventoryItem("test-sku", "asset-1", 3)]]])
  );
  const gateway = new FakeTradeOfferGateway();
  const service = new BotTradeService(repository, provider, gateway);

  const result = await service.createOffer({
    fromBotName: "from-bot",
    toBotName: "to-bot",
    toBotTradeToken: "token-123",
    appId: 440,
    contextId: "2",
    sku: "test-sku",
    amount: 2,
  });

  assert.strictEqual(result.tradeOfferId, "offer-123");
  assert.strictEqual(gateway.lastAssets?.length, 1);
  assert.strictEqual(gateway.lastAssets?.[0]?.amount, 2);
  assert.strictEqual(gateway.lastPartnerTradeToken, "token-123");
});

void test("createOffer fails when requested amount exceeds available", async () => {
  const bots: Bot[] = [
    {
      id: "from",
      name: "from-bot",
      steamId: "1",
      accountName: "from-account",
      tradeToken: null,
      sharedSecret: "shared",
      onboardingState: "AUTO_READY",
    },
    { id: "to", name: "to-bot", steamId: "2", accountName: "to-account", tradeToken: null },
  ];
  const session: BotSession = {
    botId: "from",
    sessionToken: "sessionid",
    webCookies: ["sessionid=sessionid"],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    lastCheckedAt: null,
  };
  const repository = new FakeBotSessionRepository(bots, new Map([["from", session]]));
  const provider = new FakeInventoryProvider(
    new Map([["1:440:2", [createInventoryItem("test-sku", "asset-1", 1)]]])
  );
  const gateway = new FakeTradeOfferGateway();
  const service = new BotTradeService(repository, provider, gateway);

  await assert.rejects(
    () =>
      service.createOffer({
        fromBotName: "from-bot",
        toBotName: "to-bot",
        appId: 440,
        contextId: "2",
        sku: "test-sku",
        amount: 2,
      }),
    /Insufficient quantity/
  );
});

void test("createOffer uses target bot stored trade token when cli token is omitted", async () => {
  const bots: Bot[] = [
    {
      id: "from",
      name: "from-bot",
      steamId: "1",
      accountName: "from-account",
      tradeToken: null,
      sharedSecret: "shared",
      onboardingState: "AUTO_READY",
    },
    { id: "to", name: "to-bot", steamId: "2", accountName: "to-account", tradeToken: "stored-token" },
  ];
  const session: BotSession = {
    botId: "from",
    sessionToken: "sessionid",
    webCookies: ["sessionid=sessionid"],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    lastCheckedAt: null,
  };
  const repository = new FakeBotSessionRepository(bots, new Map([["from", session]]));
  const provider = new FakeInventoryProvider(
    new Map([["1:440:2", [createInventoryItem("test-sku", "asset-1", 1)]]])
  );
  const gateway = new FakeTradeOfferGateway();
  const service = new BotTradeService(repository, provider, gateway);

  await service.createOffer({
    fromBotName: "from-bot",
    toBotName: "to-bot",
    appId: 440,
    contextId: "2",
    sku: "test-sku",
    amount: 1,
  });

  assert.strictEqual(gateway.lastPartnerTradeToken, "stored-token");
});

void test("createOffer blocks non-tradable source bot during onboarding lock", async () => {
  const bots: Bot[] = [
    {
      id: "from",
      name: "from-bot",
      steamId: "1",
      accountName: "from-account",
      tradeToken: null,
      sharedSecret: "secret",
      onboardingState: "ONBOARDING_LOCKED",
      tradeLockedUntil: new Date(Date.now() + 1000 * 60 * 60),
    },
    { id: "to", name: "to-bot", steamId: "2", accountName: "to-account", tradeToken: null },
  ];
  const session: BotSession = {
    botId: "from",
    sessionToken: "sessionid",
    webCookies: ["sessionid=sessionid"],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    lastCheckedAt: null,
  };
  const repository = new FakeBotSessionRepository(bots, new Map([["from", session]]));
  const provider = new FakeInventoryProvider(new Map());
  const gateway = new FakeTradeOfferGateway();
  const service = new BotTradeService(repository, provider, gateway);

  await assert.rejects(
    () =>
      service.createOffer({
        fromBotName: "from-bot",
        toBotName: "to-bot",
        appId: 440,
        contextId: "2",
        sku: "test-sku",
        amount: 1,
      }),
    /not tradable/
  );
});
