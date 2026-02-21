import test from "node:test";
import assert from "node:assert/strict";
import { BotSessionService } from "./bot-session-service";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { SteamAuthGateway } from "../port/steam-auth-gateway";
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
      bot: { id: "bot-a", name: "alpha", steamId: "1", accountName: "alpha_acc" },
      session: {
        botId: "bot-a",
        sessionToken: "token-a",
        expiresAt: new Date("2026-02-22T00:00:00.000Z"),
        lastCheckedAt: null,
      },
    },
    {
      bot: { id: "bot-b", name: "beta", steamId: "2", accountName: "beta_acc" },
      session: null,
    },
    {
      bot: { id: "bot-c", name: "charlie", steamId: "3", accountName: "charlie_acc" },
      session: {
        botId: "bot-c",
        sessionToken: "token-c",
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
