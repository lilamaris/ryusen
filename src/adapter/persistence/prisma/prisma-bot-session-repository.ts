import {
  PrismaClient,
  type BotSession as PrismaBotSession,
} from "@prisma/client";
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
    const record = await this.prisma.bot.create({
      data: input,
      select: {
        id: true,
        name: true,
        steamId: true,
        accountName: true,
      },
    });
    return toBot(record);
  }

  async findBotByName(name: string): Promise<Bot | null> {
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
    const records = await this.prisma.bot.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        steamId: true,
        accountName: true,
      },
    });
    return records.map(toBot);
  }

  async listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>> {
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

    return records.map((record) => ({
      bot: toBot(record),
      session: record.session ? toSession(record.session) : null,
    }));
  }

  async upsertSession(input: {
    botId: string;
    sessionToken: string;
    expiresAt: Date;
  }): Promise<BotSession> {
    const record = await this.prisma.botSession.upsert({
      where: { botId: input.botId },
      create: input,
      update: {
        sessionToken: input.sessionToken,
        expiresAt: input.expiresAt,
      },
    });

    return toSession(record);
  }

  async findSessionByBotId(botId: string): Promise<BotSession | null> {
    const record = await this.prisma.botSession.findUnique({
      where: { botId },
    });
    return record ? toSession(record) : null;
  }

  async markSessionChecked(botId: string, checkedAt: Date): Promise<void> {
    await this.prisma.botSession.update({
      where: { botId },
      data: { lastCheckedAt: checkedAt },
    });
  }
}
