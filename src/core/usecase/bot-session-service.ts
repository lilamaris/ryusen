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

  async addBotWithAuthentication(input: {
    name: string;
    steamId: string;
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<void> {
    const bot = await this.repository.createBot({
      name: input.name,
      steamId: input.steamId,
      accountName: input.accountName,
    });

    const authResult = await this.steamAuthGateway.authenticateWithCredentials({
      accountName: input.accountName,
      password: input.password,
      prompts: input.prompts,
    });

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
    const bots = await this.repository.listBots();
    const statuses: BotSessionStatus[] = [];

    for (const bot of bots) {
      const status = await this.buildSessionStatus(bot, now);
      statuses.push(status);
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
