import type { BotSessionStatus } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";

export class BotSessionService {
  constructor(private readonly repository: BotSessionRepository) {}

  async registerBot(input: { name: string; steamId: string }): Promise<void> {
    await this.repository.createBot(input);
  }

  async connectBot(input: {
    botName: string;
    sessionToken: string;
    expiresAt: Date;
  }): Promise<void> {
    const bot = await this.repository.findBotByName(input.botName);
    if (!bot) {
      throw new Error(`Bot not found: ${input.botName}`);
    }

    await this.repository.upsertSession({
      botId: bot.id,
      sessionToken: input.sessionToken,
      expiresAt: input.expiresAt,
    });
  }

  async checkBotSession(botName: string, now: Date = new Date()): Promise<BotSessionStatus> {
    const bot = await this.repository.findBotByName(botName);
    if (!bot) {
      throw new Error(`Bot not found: ${botName}`);
    }

    const session = await this.repository.findSessionByBotId(bot.id);
    if (!session) {
      return {
        bot,
        hasSession: false,
        isValid: false,
        expiresAt: null,
        lastCheckedAt: null,
      };
    }

    const isValid = session.expiresAt.getTime() > now.getTime();
    await this.repository.markSessionChecked(bot.id, now);

    return {
      bot,
      hasSession: true,
      isValid,
      expiresAt: session.expiresAt,
      lastCheckedAt: now,
    };
  }
}
