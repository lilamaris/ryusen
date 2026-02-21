import test from "node:test";
import assert from "node:assert/strict";
import { BotInventoryQueryService } from "./bot-inventory-query-service";
import type { Bot, BotSession } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";

class FakeRepository implements BotSessionRepository {
  constructor(
    private readonly bots: Bot[],
    private readonly sessionsByBotId: Record<string, BotSession | null>
  ) {}

  createBot(): Promise<Bot> {
    return Promise.reject(new Error("not used"));
  }

  findBotByName(name: string): Promise<Bot | null> {
    return Promise.resolve(this.bots.find((bot) => bot.name === name) ?? null);
  }

  listBots(): Promise<Bot[]> {
    return Promise.resolve(this.bots);
  }

  listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
    return Promise.resolve(
      this.bots.map((bot) => ({
        bot,
        session: this.sessionsByBotId[bot.id] ?? null,
      }))
    );
  }

  upsertSession(): Promise<BotSession> {
    return Promise.reject(new Error("not used"));
  }

  findSessionByBotId(botId: string): Promise<BotSession | null> {
    return Promise.resolve(this.sessionsByBotId[botId] ?? null);
  }

  markSessionChecked(): Promise<void> {
    return Promise.resolve();
  }
}

void test("resolveByBotName returns skip reason when bot not found", async () => {
  const service = new BotInventoryQueryService(new FakeRepository([], {}));
  const result = await service.resolveByBotName({
    botName: "unknown",
    appId: 440,
    contextId: "2",
    allowPublicFallback: false,
    now: new Date("2026-02-21T00:00:00.000Z"),
  });

  assert.deepEqual(result, {
    targets: [],
    skipped: [{ botName: "unknown", reason: "bot_not_found" }],
  });
});

void test("resolveByBotName returns authenticated query when valid session exists", async () => {
  const bot: Bot = { id: "b1", name: "alpha", steamId: "123", accountName: "alpha_acc" };
  const session: BotSession = {
    botId: "b1",
    sessionToken: "token",
    webCookies: ["sessionid=abc"],
    expiresAt: new Date("2026-02-22T00:00:00.000Z"),
    lastCheckedAt: null,
  };

  const service = new BotInventoryQueryService(new FakeRepository([bot], { b1: session }));
  const result = await service.resolveByBotName({
    botName: "alpha",
    appId: 440,
    contextId: "2",
    allowPublicFallback: false,
    now: new Date("2026-02-21T00:00:00.000Z"),
  });

  assert.deepEqual(result, {
    targets: [
      {
        botName: "alpha",
        query: {
          steamId: "123",
          appId: 440,
          contextId: "2",
          webCookies: ["sessionid=abc"],
        },
      },
    ],
    skipped: [],
  });
});

void test("resolveAllBots can fallback to public query for expired/missing sessions", async () => {
  const bots: Bot[] = [
    { id: "b1", name: "alpha", steamId: "111", accountName: "a" },
    { id: "b2", name: "beta", steamId: "222", accountName: "b" },
    { id: "b3", name: "gamma", steamId: "333", accountName: "c" },
  ];

  const sessionsByBotId: Record<string, BotSession | null> = {
    b1: {
      botId: "b1",
      sessionToken: "token-a",
      webCookies: ["sessionid=a"],
      expiresAt: new Date("2026-02-22T00:00:00.000Z"),
      lastCheckedAt: null,
    },
    b2: {
      botId: "b2",
      sessionToken: "token-b",
      webCookies: ["sessionid=b"],
      expiresAt: new Date("2026-02-20T00:00:00.000Z"),
      lastCheckedAt: null,
    },
    b3: null,
  };

  const service = new BotInventoryQueryService(new FakeRepository(bots, sessionsByBotId));
  const result = await service.resolveAllBots({
    appId: 440,
    contextId: "2",
    allowPublicFallback: true,
    now: new Date("2026-02-21T00:00:00.000Z"),
  });

  assert.equal(result.targets.length, 3);
  assert.equal(result.targets[0]?.query.webCookies?.[0], "sessionid=a");
  assert.equal(result.targets[1]?.query.webCookies, undefined);
  assert.equal(result.targets[2]?.query.webCookies, undefined);
  assert.deepEqual(result.skipped, []);
});
