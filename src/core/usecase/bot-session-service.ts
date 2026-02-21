import type { Bot, BotSessionStatus } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { SteamAuthGateway, SteamGuardPrompts } from "../port/steam-auth-gateway";
import type { DebugLogger } from "./debug-logger";

export class BotSessionService {
  constructor(
    private readonly repository: BotSessionRepository,
    private readonly steamAuthGateway: SteamAuthGateway,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("BotSessionService", message, meta);
  }

  async registerBot(input: { name: string; steamId: string; accountName: string }): Promise<void> {
    this.debug("registerBot:start", {
      name: input.name,
      steamId: input.steamId,
      accountName: input.accountName,
    });
    await this.repository.createBot(input);
    this.debug("registerBot:done", { name: input.name });
  }

  async addOrAuthenticateBot(input: {
    name: string;
    steamId: string;
    accountName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<void> {
    this.debug("addOrAuthenticateBot:start", {
      name: input.name,
      steamId: input.steamId,
      accountName: input.accountName,
    });

    const authResult = await this.steamAuthGateway.authenticateWithCredentials({
      accountName: input.accountName,
      password: input.password,
      prompts: input.prompts,
    });
    this.debug("addOrAuthenticateBot:authenticated", {
      name: input.name,
      expiresAt: authResult.expiresAt.toISOString(),
      webCookiesCount: authResult.webCookies.length,
    });

    let bot = await this.repository.findBotByName(input.name);
    if (bot) {
      if (bot.steamId !== input.steamId || bot.accountName !== input.accountName) {
        this.debug("addOrAuthenticateBot:conflict", {
          name: input.name,
          existingSteamId: bot.steamId,
          inputSteamId: input.steamId,
          existingAccountName: bot.accountName,
          inputAccountName: input.accountName,
        });
        throw new Error(`Bot already exists with different steamId/accountName: ${input.name}`);
      }
      this.debug("addOrAuthenticateBot:reuseExistingBot", { name: input.name });
    } else {
      bot = await this.repository.createBot({
        name: input.name,
        steamId: input.steamId,
        accountName: input.accountName,
      });
      this.debug("addOrAuthenticateBot:createdBot", { name: input.name });
    }

    await this.repository.upsertSession({
      botId: bot.id,
      sessionToken: authResult.sessionToken,
      webCookies: authResult.webCookies,
      expiresAt: authResult.expiresAt,
    });
    this.debug("addOrAuthenticateBot:sessionUpserted", {
      name: input.name,
      expiresAt: authResult.expiresAt.toISOString(),
    });
  }

  async reauthenticateBot(input: {
    botName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<void> {
    this.debug("reauthenticateBot:start", { botName: input.botName });

    const bot = await this.repository.findBotByName(input.botName);
    if (!bot) {
      this.debug("reauthenticateBot:botNotFound", { botName: input.botName });
      throw new Error(`Bot not found: ${input.botName}`);
    }

    const authResult = await this.steamAuthGateway.authenticateWithCredentials({
      accountName: bot.accountName,
      password: input.password,
      prompts: input.prompts,
    });
    this.debug("reauthenticateBot:authenticated", {
      botName: input.botName,
      expiresAt: authResult.expiresAt.toISOString(),
      webCookiesCount: authResult.webCookies.length,
    });

    await this.repository.upsertSession({
      botId: bot.id,
      sessionToken: authResult.sessionToken,
      webCookies: authResult.webCookies,
      expiresAt: authResult.expiresAt,
    });
    this.debug("reauthenticateBot:sessionUpserted", {
      botName: input.botName,
      expiresAt: authResult.expiresAt.toISOString(),
    });
  }

  async checkBotSession(botName: string, now: Date = new Date()): Promise<BotSessionStatus> {
    this.debug("checkBotSession:start", { botName, now: now.toISOString() });

    const bot = await this.repository.findBotByName(botName);
    if (!bot) {
      this.debug("checkBotSession:botNotFound", { botName });
      throw new Error(`Bot not found: ${botName}`);
    }

    const status = await this.buildSessionStatus(bot, now);
    this.debug("checkBotSession:result", {
      botName,
      hasSession: status.hasSession,
      isValid: status.isValid,
      expiresAt: status.expiresAt?.toISOString() ?? null,
    });
    return status;
  }

  async listBotSessions(now: Date = new Date()): Promise<BotSessionStatus[]> {
    this.debug("listBotSessions:start", { now: now.toISOString() });

    const botsWithSessions = await this.repository.listBotsWithSessions();
    const statuses: BotSessionStatus[] = [];
    this.debug("listBotSessions:loadedBots", { count: botsWithSessions.length });

    for (const item of botsWithSessions) {
      if (!item.session) {
        statuses.push({
          bot: item.bot,
          hasSession: false,
          isValid: false,
          expiresAt: null,
          lastCheckedAt: null,
        });
        this.debug("listBotSessions:bot", {
          botName: item.bot.name,
          hasSession: false,
          isValid: false,
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
      this.debug("listBotSessions:bot", {
        botName: item.bot.name,
        hasSession: true,
        isValid,
        expiresAt: item.session.expiresAt.toISOString(),
      });
    }

    this.debug("listBotSessions:result", { count: statuses.length });
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
