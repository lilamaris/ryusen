import test from "node:test";
import assert from "node:assert/strict";
import { BotSessionService } from "./bot-session-service";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { SteamAuthGateway, SteamGuardPrompts } from "../port/steam-auth-gateway";
import type { Bot, BotSession } from "../bot/bot-session";

class FakeRepository implements BotSessionRepository {
  public listBotsWithSessionsCalls = 0;
  public findSessionByBotIdCalls = 0;
  public checked: Array<{ botId: string; checkedAt: Date }> = [];

  constructor(private readonly rows: Array<{ bot: Bot; session: BotSession | null }>) {}

  createBot(): Promise<Bot> {
    return Promise.reject(new Error("not used"));
  }

  findBotByName(): Promise<Bot | null> {
    return Promise.reject(new Error("not used"));
  }

  findBotBySteamId(): Promise<Bot | null> {
    return Promise.reject(new Error("not used"));
  }

  updateBotIdentity(): Promise<Bot> {
    return Promise.reject(new Error("not used"));
  }

  listBots(): Promise<Bot[]> {
    return Promise.reject(new Error("listBots should not be called in listBotSessions"));
  }

  listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
    this.listBotsWithSessionsCalls += 1;
    return Promise.resolve(this.rows);
  }

  upsertSession(): Promise<BotSession> {
    return Promise.reject(new Error("not used"));
  }

  findSessionByBotId(): Promise<BotSession | null> {
    this.findSessionByBotIdCalls += 1;
    return Promise.reject(new Error("findSessionByBotId should not be called in listBotSessions"));
  }

  markSessionChecked(botId: string, checkedAt: Date): Promise<void> {
    this.checked.push({ botId, checkedAt });
    return Promise.resolve();
  }

  setBotTradeToken(): Promise<Bot> {
    return Promise.reject(new Error("not used"));
  }

  setBotTradeSecretsBySteamId(): Promise<Bot> {
    return Promise.reject(new Error("not used"));
  }
}

class FakeAuthGateway implements SteamAuthGateway {
  authenticateWithCredentials(): Promise<never> {
    return Promise.reject(new Error("not used"));
  }
}

void test("listBotSessions uses bulk session read and marks checked only for existing sessions", async () => {
  const now = new Date("2026-02-21T10:00:00.000Z");
  const repository = new FakeRepository([
    {
      bot: { id: "bot-a", name: "alpha", steamId: "1", accountName: "alpha_acc", tradeToken: null },
      session: {
        botId: "bot-a",
        sessionToken: "token-a",
        webCookies: ["sessionid=a"],
        expiresAt: new Date("2026-02-22T00:00:00.000Z"),
        lastCheckedAt: null,
      },
    },
    {
      bot: { id: "bot-b", name: "beta", steamId: "2", accountName: "beta_acc", tradeToken: null },
      session: null,
    },
    {
      bot: { id: "bot-c", name: "charlie", steamId: "3", accountName: "charlie_acc", tradeToken: null },
      session: {
        botId: "bot-c",
        sessionToken: "token-c",
        webCookies: ["sessionid=c"],
        expiresAt: new Date("2026-02-20T00:00:00.000Z"),
        lastCheckedAt: null,
      },
    },
  ]);

  const service = new BotSessionService(repository, new FakeAuthGateway());
  const statuses = await service.listBotSessions(now);

  assert.equal(repository.listBotsWithSessionsCalls, 1);
  assert.equal(repository.findSessionByBotIdCalls, 0);
  assert.deepEqual(
    repository.checked,
    [
      { botId: "bot-a", checkedAt: now },
      { botId: "bot-c", checkedAt: now },
    ]
  );

  assert.deepEqual(
    statuses.map((status) => ({
      name: status.bot.name,
      hasSession: status.hasSession,
      isValid: status.isValid,
      lastCheckedAt: status.lastCheckedAt,
    })),
    [
      { name: "alpha", hasSession: true, isValid: true, lastCheckedAt: now },
      { name: "beta", hasSession: false, isValid: false, lastCheckedAt: null },
      { name: "charlie", hasSession: true, isValid: false, lastCheckedAt: now },
    ]
  );
});

void test("setTradeToken updates existing bot token", async () => {
  class SetTokenRepository implements BotSessionRepository {
    public updated: Array<{ botName: string; tradeToken: string }> = [];

    createBot(): Promise<Bot> {
      return Promise.reject(new Error("not used"));
    }

    findBotByName(name: string): Promise<Bot | null> {
      return Promise.resolve({
        id: "bot-a",
        name,
        steamId: "1",
        accountName: "alpha",
        tradeToken: null,
      });
    }

    findBotBySteamId(): Promise<Bot | null> {
      return Promise.reject(new Error("not used"));
    }

    updateBotIdentity(): Promise<Bot> {
      return Promise.reject(new Error("not used"));
    }

    listBots(): Promise<Bot[]> {
      return Promise.reject(new Error("not used"));
    }

    listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
      return Promise.reject(new Error("not used"));
    }

    upsertSession(): Promise<BotSession> {
      return Promise.reject(new Error("not used"));
    }

    findSessionByBotId(): Promise<BotSession | null> {
      return Promise.reject(new Error("not used"));
    }

    markSessionChecked(): Promise<void> {
      return Promise.reject(new Error("not used"));
    }

    setBotTradeToken(botName: string, tradeToken: string): Promise<Bot> {
      this.updated.push({ botName, tradeToken });
      return Promise.resolve({
        id: "bot-a",
        name: botName,
        steamId: "1",
        accountName: "alpha",
        tradeToken,
      });
    }

    setBotTradeSecretsBySteamId(): Promise<Bot> {
      return Promise.reject(new Error("not used"));
    }
  }

  const repository = new SetTokenRepository();
  const service = new BotSessionService(repository, new FakeAuthGateway());
  await service.setTradeToken({ botName: "alpha", tradeToken: "token-1" });
  assert.deepEqual(repository.updated, [{ botName: "alpha", tradeToken: "token-1" }]);
});

void test("syncBotsFromDeclaration creates bots, applies secrets, and updates sessions", async () => {
  type RepoBot = Bot & { sharedSecret: string | null; identitySecret: string | null };

  class SyncRepository implements BotSessionRepository {
    public bots: RepoBot[] = [];
    public sessions: Array<{ botId: string; sessionToken: string; expiresAt: Date }> = [];

    async createBot(input: { name: string; steamId: string; accountName: string }): Promise<Bot> {
      const bot: RepoBot = {
        id: `bot-${this.bots.length + 1}`,
        name: input.name,
        steamId: input.steamId,
        accountName: input.accountName,
        tradeToken: null,
        sharedSecret: null,
        identitySecret: null,
      };
      this.bots.push(bot);
      return bot;
    }

    async findBotByName(name: string): Promise<Bot | null> {
      return this.bots.find((bot) => bot.name === name) ?? null;
    }

    async findBotBySteamId(steamId: string): Promise<Bot | null> {
      return this.bots.find((bot) => bot.steamId === steamId) ?? null;
    }

    async updateBotIdentity(input: { botId: string; name: string; accountName: string }): Promise<Bot> {
      const bot = this.bots.find((item) => item.id === input.botId);
      if (!bot) {
        throw new Error("not found");
      }
      bot.name = input.name;
      bot.accountName = input.accountName;
      return bot;
    }

    listBots(): Promise<Bot[]> {
      return Promise.resolve(this.bots);
    }

    listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
      return Promise.resolve([]);
    }

    upsertSession(input: {
      botId: string;
      sessionToken: string;
      webCookies: string[];
      expiresAt: Date;
    }): Promise<BotSession> {
      this.sessions.push({ botId: input.botId, sessionToken: input.sessionToken, expiresAt: input.expiresAt });
      return Promise.resolve({
        botId: input.botId,
        sessionToken: input.sessionToken,
        webCookies: input.webCookies,
        expiresAt: input.expiresAt,
        lastCheckedAt: null,
      });
    }

    findSessionByBotId(): Promise<BotSession | null> {
      return Promise.resolve(null);
    }

    markSessionChecked(): Promise<void> {
      return Promise.resolve();
    }

    setBotTradeToken(): Promise<Bot> {
      return Promise.reject(new Error("not used"));
    }

    async setBotTradeSecretsBySteamId(
      steamId: string,
      secrets: { sharedSecret: string | null; identitySecret: string | null }
    ): Promise<Bot> {
      const bot = this.bots.find((item) => item.steamId === steamId);
      if (!bot) {
        throw new Error("not found");
      }
      bot.sharedSecret = secrets.sharedSecret;
      bot.identitySecret = secrets.identitySecret;
      return bot;
    }
  }

  class SyncAuthGateway implements SteamAuthGateway {
    authenticateWithCredentials(input: {
      accountName: string;
      password: string;
      prompts: SteamGuardPrompts;
    }): Promise<{ sessionToken: string; webCookies: string[]; expiresAt: Date }> {
      return Promise.resolve({
        sessionToken: `session-${input.accountName}-${input.password}`,
        webCookies: ["sessionid=test"],
        expiresAt: new Date("2026-02-22T00:00:00.000Z"),
      });
    }
  }

  const repository = new SyncRepository();
  const service = new BotSessionService(repository, new SyncAuthGateway());

  const result = await service.syncBotsFromDeclaration({
    accounts: [
      {
        alias: "alpha",
        steamId: "76561198000000001",
        account: "alpha_acc",
        password: "pw1",
      },
    ],
    prompts: {
      requestGuardCode: () => Promise.resolve("000000"),
      notifyPendingConfirmation: () => Promise.resolve(),
    },
    secretsBySteamId: {
      "76561198000000001": {
        sharedSecret: "shared",
        identitySecret: "identity",
      },
    },
  });

  assert.equal(result.succeeded, 1);
  assert.equal(repository.bots.length, 1);
  assert.equal(repository.bots[0]?.sharedSecret, "shared");
  assert.equal(repository.sessions.length, 1);
});

void test("syncBotSecretsFromDeclaration updates only registered bots", async () => {
  class SecretRepository implements BotSessionRepository {
    public bot: Bot = {
      id: "bot-1",
      name: "alpha",
      steamId: "76561198000000001",
      accountName: "alpha_acc",
      tradeToken: null,
      sharedSecret: null,
      identitySecret: null,
    };

    createBot(): Promise<Bot> {
      return Promise.reject(new Error("not used"));
    }

    findBotByName(): Promise<Bot | null> {
      return Promise.reject(new Error("not used"));
    }

    findBotBySteamId(steamId: string): Promise<Bot | null> {
      if (steamId === this.bot.steamId) {
        return Promise.resolve(this.bot);
      }
      return Promise.resolve(null);
    }

    updateBotIdentity(): Promise<Bot> {
      return Promise.reject(new Error("not used"));
    }

    listBots(): Promise<Bot[]> {
      return Promise.resolve([this.bot]);
    }

    listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
      return Promise.resolve([]);
    }

    upsertSession(): Promise<BotSession> {
      return Promise.reject(new Error("not used"));
    }

    findSessionByBotId(): Promise<BotSession | null> {
      return Promise.resolve(null);
    }

    markSessionChecked(): Promise<void> {
      return Promise.resolve();
    }

    setBotTradeToken(): Promise<Bot> {
      return Promise.reject(new Error("not used"));
    }

    async setBotTradeSecretsBySteamId(
      steamId: string,
      secrets: { sharedSecret: string | null; identitySecret: string | null }
    ): Promise<Bot> {
      if (steamId !== this.bot.steamId) {
        throw new Error("not found");
      }
      this.bot.sharedSecret = secrets.sharedSecret;
      this.bot.identitySecret = secrets.identitySecret;
      return this.bot;
    }
  }

  const repository = new SecretRepository();
  const service = new BotSessionService(repository, new FakeAuthGateway());
  const result = await service.syncBotSecretsFromDeclaration({
    secretsBySteamId: {
      "76561198000000001": { sharedSecret: "shared" },
      "76561198000000002": { sharedSecret: "other" },
    },
  });

  assert.equal(result.total, 2);
  assert.equal(result.updated, 1);
  assert.equal(result.failed, 1);
  assert.equal(repository.bot.sharedSecret, "shared");
});
