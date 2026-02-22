import type { Bot, BotOnboardingState, BotSession } from "../type/session";

export interface BotSessionRepository {
  createBot(input: { name: string; steamId: string; accountName: string }): Promise<Bot>;
  findBotByName(name: string): Promise<Bot | null>;
  findBotBySteamId(steamId: string): Promise<Bot | null>;
  updateBotIdentity(input: { botId: string; name: string; accountName: string }): Promise<Bot>;
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
  setBotTradeToken(botName: string, tradeToken: string): Promise<Bot>;
  setBotTradeSecretsBySteamId(
    steamId: string,
    secrets: {
      sharedSecret: string | null;
      identitySecret: string | null;
      revocationCode?: string | null;
      onboardingState?: BotOnboardingState;
      onboardingStartedAt?: Date | null;
      tradeLockedUntil?: Date | null;
    }
  ): Promise<Bot>;
  setBotOnboardingState(input: {
    botId: string;
    onboardingState: BotOnboardingState;
    tradeLockedUntil: Date | null;
  }): Promise<Bot>;
}
