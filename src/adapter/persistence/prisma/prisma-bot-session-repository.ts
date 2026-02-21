import {
  PrismaClient,
  type BotSession as PrismaBotSession,
} from "@prisma/client";
import { debugLog } from "../../../debug";
import type { Bot, BotSession } from "../../../core/bot/bot-session";
import type { BotSessionRepository } from "../../../core/port/bot-session-repository";

type BotRecord = {
  id: string;
  name: string;
  steamId: string;
  accountName: string;
};

function toBot(record: BotRecord): Bot {
  return {
    id: record.id,
    name: record.name,
    steamId: record.steamId,
    accountName: record.accountName,
  };
}

function toSession(record: PrismaBotSession): BotSession {
  return {
    botId: record.botId,
    sessionToken: record.sessionToken,
    webCookies: record.webCookies,
    expiresAt: record.expiresAt,
    lastCheckedAt: record.lastCheckedAt,
  };
}

export class PrismaBotSessionRepository implements BotSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createBot(input: {
    name: string;
    steamId: string;
    accountName: string;
  }): Promise<Bot> {
    debugLog("PrismaBotSessionRepository", "createBot:start", {
      name: input.name,
      steamId: input.steamId,
      accountName: input.accountName,
    });
    const record = await this.prisma.bot.create({
      data: input,
      select: {
        id: true,
        name: true,
        steamId: true,
        accountName: true,
      },
    });
    debugLog("PrismaBotSessionRepository", "createBot:done", { id: record.id, name: record.name });
    return toBot(record);
  }

  async findBotByName(name: string): Promise<Bot | null> {
    debugLog("PrismaBotSessionRepository", "findBotByName", { name });
    const record = await this.prisma.bot.findUnique({
      where: { name },
      select: {
        id: true,
        name: true,
        steamId: true,
        accountName: true,
      },
    });
    return record ? toBot(record) : null;
  }

  async listBots(): Promise<Bot[]> {
    debugLog("PrismaBotSessionRepository", "listBots:start");
    const records = await this.prisma.bot.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        steamId: true,
        accountName: true,
      },
    });
    debugLog("PrismaBotSessionRepository", "listBots:done", { count: records.length });
    return records.map(toBot);
  }

  async listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
    debugLog("PrismaBotSessionRepository", "listBotsWithSessions:start");
    const records = await this.prisma.bot.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        steamId: true,
        accountName: true,
        session: true,
      },
    });
    debugLog("PrismaBotSessionRepository", "listBotsWithSessions:done", { count: records.length });

    return records.map((record) => ({
      bot: toBot(record),
      session: record.session ? toSession(record.session) : null,
    }));
  }

  async upsertSession(input: {
    botId: string;
    sessionToken: string;
    webCookies: string[];
    expiresAt: Date;
  }): Promise<BotSession> {
    debugLog("PrismaBotSessionRepository", "upsertSession:start", {
      botId: input.botId,
      expiresAt: input.expiresAt.toISOString(),
      webCookiesCount: input.webCookies.length,
    });
    const record = await this.prisma.botSession.upsert({
      where: { botId: input.botId },
      create: input,
      update: {
        sessionToken: input.sessionToken,
        webCookies: input.webCookies,
        expiresAt: input.expiresAt,
      },
    });
    debugLog("PrismaBotSessionRepository", "upsertSession:done", { botId: input.botId });

    return toSession(record);
  }

  async findSessionByBotId(botId: string): Promise<BotSession | null> {
    debugLog("PrismaBotSessionRepository", "findSessionByBotId", { botId });
    const record = await this.prisma.botSession.findUnique({
      where: { botId },
    });
    return record ? toSession(record) : null;
  }

  async markSessionChecked(botId: string, checkedAt: Date): Promise<void> {
    debugLog("PrismaBotSessionRepository", "markSessionChecked", {
      botId,
      checkedAt: checkedAt.toISOString(),
    });
    await this.prisma.botSession.update({
      where: { botId },
      data: { lastCheckedAt: checkedAt },
    });
  }
}
