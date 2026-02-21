import type { Bot, BotSession } from "../bot/bot-session";

export interface BotSessionRepository {
  createBot(input: { name: string; steamId: string; accountName: string }): Promise<Bot>;
  findBotByName(name: string): Promise<Bot | null>;
  listBots(): Promise<Bot[]>;
  listBotsWithSessions(): Promise<Array<{ bot: Bot; session: BotSession | null }>>;
  upsertSession(input: {
    botId: string;
    sessionToken: string;
    webCookies: string[];
    expiresAt: Date;
  }): Promise<BotSession>;
  findSessionByBotId(botId: string): Promise<BotSession | null>;
  markSessionChecked(botId: string, checkedAt: Date): Promise<void>;
}
