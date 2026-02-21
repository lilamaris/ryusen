import { PrismaClient, type Bot as PrismaBot, type BotSession as PrismaBotSession } from "@prisma/client";
import type { Bot, BotSession } from "../../../core/bot/bot-session";
import type { BotSessionRepository } from "../../../core/port/bot-session-repository";

function toBot(record: PrismaBot): Bot {
  return {
    id: record.id,
    name: record.name,
    steamId: record.steamId,
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

  async createBot(input: { name: string; steamId: string }): Promise<Bot> {
    const record = await this.prisma.bot.create({ data: input });
    return toBot(record);
  }

  async findBotByName(name: string): Promise<Bot | null> {
    const record = await this.prisma.bot.findUnique({ where: { name } });
    return record ? toBot(record) : null;
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
    const record = await this.prisma.botSession.findUnique({ where: { botId } });
    return record ? toSession(record) : null;
  }

  async markSessionChecked(botId: string, checkedAt: Date): Promise<void> {
    await this.prisma.botSession.update({
      where: { botId },
      data: { lastCheckedAt: checkedAt },
    });
  }
}
