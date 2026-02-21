import type { Bot, BotSessionStatus } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { SteamAuthGateway, SteamGuardPrompts } from "../port/steam-auth-gateway";

export class BotSessionService {
  constructor(
    private readonly repository: BotSessionRepository,
    private readonly steamAuthGateway: SteamAuthGateway
  ) {}

  async registerBot(input: { name: string; steamId: string; accountName: string }): Promise<void> {
    await this.repository.createBot(input);
  }

  async addOrAuthenticateBot(input: {
    name: string;
    steamId: string;
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<void> {
    const authResult = await this.steamAuthGateway.authenticateWithCredentials({
      accountName: input.accountName,
      password: input.password,
      prompts: input.prompts,
    });

    let bot = await this.repository.findBotByName(input.name);
    if (bot) {
      if (bot.steamId !== input.steamId || bot.accountName !== input.accountName) {
        throw new Error(`Bot already exists with different steamId/accountName: ${input.name}`);
      }
    } else {
      bot = await this.repository.createBot({
        name: input.name,
        steamId: input.steamId,
        accountName: input.accountName,
      });
    }

    await this.repository.upsertSession({
      botId: bot.id,
      sessionToken: authResult.sessionToken,
      expiresAt: authResult.expiresAt,
    });
  }

  async reauthenticateBot(input: {
    botName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<void> {
    const bot = await this.repository.findBotByName(input.botName);
    if (!bot) {
      throw new Error(`Bot not found: ${input.botName}`);
    }

    const authResult = await this.steamAuthGateway.authenticateWithCredentials({
      accountName: bot.accountName,
      password: input.password,
      prompts: input.prompts,
    });

    await this.repository.upsertSession({
      botId: bot.id,
      sessionToken: authResult.sessionToken,
      expiresAt: authResult.expiresAt,
    });
  }

  async checkBotSession(botName: string, now: Date = new Date()): Promise<BotSessionStatus> {
    const bot = await this.repository.findBotByName(botName);
    if (!bot) {
      throw new Error(`Bot not found: ${botName}`);
    }

    return this.buildSessionStatus(bot, now);
  }

  async listBotSessions(now: Date = new Date()): Promise<BotSessionStatus[]> {
    const botsWithSessions = await this.repository.listBotsWithSessions();
    const statuses: BotSessionStatus[] = [];

    for (const item of botsWithSessions) {
      if (!item.session) {
        statuses.push({
          bot: item.bot,
          hasSession: false,
          isValid: false,
          expiresAt: null,
          lastCheckedAt: null,
        });
        continue;
      }

      const isValid = item.session.expiresAt.getTime() > now.getTime();
      await this.repository.markSessionChecked(item.bot.id, now);

      statuses.push({
        bot: item.bot,
        hasSession: true,
        isValid,
        expiresAt: item.session.expiresAt,
        lastCheckedAt: now,
      });
    }

    return statuses;
  }

  private async buildSessionStatus(bot: Bot, now: Date): Promise<BotSessionStatus> {
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
