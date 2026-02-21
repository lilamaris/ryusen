import type { Bot, BotSession } from "../bot/bot-session";

export interface BotSessionRepository {
  createBot(input: { name: string; steamId: string; accountName: string }): Promise<Bot>;
  findBotByName(name: string): Promise<Bot | null>;
  listBots(): Promise<Bot[]>;
  upsertSession(input: { botId: string; sessionToken: string; expiresAt: Date }): Promise<BotSession>;
  findSessionByBotId(botId: string): Promise<BotSession | null>;
  markSessionChecked(botId: string, checkedAt: Date): Promise<void>;
}
