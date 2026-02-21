import type { Bot, BotSessionStatus } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { SteamAuthGateway, SteamGuardPrompts } from "../port/steam-auth-gateway";
import type { DebugLogger } from "./debug-logger";

export type BotDeclarationAccount = {
  alias: string;
  steamId: string;
  account: string;
  password: string;
};

export type BotTradeSecretsDeclaration = {
  sharedSecret?: string;
  identitySecret?: string;
};

export type BotSyncResult = {
  total: number;
  succeeded: number;
  failed: number;
  rows: Array<{
    alias: string;
    steamId: string;
    status: "ok" | "error";
    message: string;
  }>;
};

export type BotSecretSyncResult = {
  total: number;
  updated: number;
  failed: number;
  rows: Array<{
    steamId: string;
    status: "updated" | "error";
    message: string;
  }>;
};

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

  async setTradeToken(input: { botName: string; tradeToken: string }): Promise<void> {
    const tradeToken = input.tradeToken.trim();
    if (!tradeToken) {
      throw new Error("tradeToken must not be empty");
    }

    this.debug("setTradeToken:start", { botName: input.botName });
    const bot = await this.repository.findBotByName(input.botName);
    if (!bot) {
      throw new Error(`Bot not found: ${input.botName}`);
    }

    await this.repository.setBotTradeToken(input.botName, tradeToken);
    this.debug("setTradeToken:done", { botName: input.botName });
  }

  async syncBotsFromDeclaration(input: {
    accounts: BotDeclarationAccount[];
    prompts: SteamGuardPrompts;
    secretsBySteamId?: Record<string, BotTradeSecretsDeclaration>;
  }): Promise<BotSyncResult> {
    const rows: BotSyncResult["rows"] = [];
    let succeeded = 0;

    for (const item of input.accounts) {
      const alias = item.alias.trim();
      const steamId = item.steamId.trim();
      const accountName = item.account.trim();
      const password = item.password.trim();

      if (!alias || !steamId || !accountName || !password) {
        rows.push({
          alias: item.alias,
          steamId: item.steamId,
          status: "error",
          message: "alias, steamId, account, password are required",
        });
        continue;
      }

      try {
        const bot = await this.ensureBotIdentity({
          alias,
          steamId,
          accountName,
        });

        const secrets = input.secretsBySteamId?.[steamId];
        if (secrets) {
          await this.repository.setBotTradeSecretsBySteamId(steamId, {
            sharedSecret: secrets.sharedSecret?.trim() || null,
            identitySecret: secrets.identitySecret?.trim() || null,
          });
        }

        const authResult = await this.steamAuthGateway.authenticateWithCredentials({
          accountName,
          password,
          prompts: input.prompts,
        });

        await this.repository.upsertSession({
          botId: bot.id,
          sessionToken: authResult.sessionToken,
          webCookies: authResult.webCookies,
          expiresAt: authResult.expiresAt,
        });

        rows.push({
          alias,
          steamId,
          status: "ok",
          message: `session updated (expires ${authResult.expiresAt.toISOString()})`,
        });
        succeeded += 1;
      } catch (error: unknown) {
        rows.push({
          alias,
          steamId,
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      total: input.accounts.length,
      succeeded,
      failed: input.accounts.length - succeeded,
      rows,
    };
  }

  async syncBotSecretsFromDeclaration(input: {
    secretsBySteamId: Record<string, BotTradeSecretsDeclaration>;
  }): Promise<BotSecretSyncResult> {
    const rows: BotSecretSyncResult["rows"] = [];
    const steamIds = Object.keys(input.secretsBySteamId);
    let updated = 0;

    for (const steamId of steamIds) {
      try {
        const bot = await this.repository.findBotBySteamId(steamId);
        if (!bot) {
          throw new Error(`Bot not found for steamId: ${steamId}`);
        }

        const secrets = input.secretsBySteamId[steamId];
        if (!secrets) {
          throw new Error(`Secrets entry not found for steamId: ${steamId}`);
        }
        await this.repository.setBotTradeSecretsBySteamId(steamId, {
          sharedSecret: secrets.sharedSecret?.trim() || null,
          identitySecret: secrets.identitySecret?.trim() || null,
        });
        rows.push({
          steamId,
          status: "updated",
          message: "secrets updated",
        });
        updated += 1;
      } catch (error: unknown) {
        rows.push({
          steamId,
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      total: steamIds.length,
      updated,
      failed: steamIds.length - updated,
      rows,
    };
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

  private async ensureBotIdentity(input: {
    alias: string;
    steamId: string;
    accountName: string;
  }): Promise<Bot> {
    const byAlias = await this.repository.findBotByName(input.alias);
    if (byAlias && byAlias.steamId !== input.steamId) {
      throw new Error(`Alias already mapped to another steamId: ${input.alias}`);
    }

    const bySteamId = await this.repository.findBotBySteamId(input.steamId);
    if (!bySteamId) {
      return this.repository.createBot({
        name: input.alias,
        steamId: input.steamId,
        accountName: input.accountName,
      });
    }

    if (bySteamId.name === input.alias && bySteamId.accountName === input.accountName) {
      return bySteamId;
    }

    return this.repository.updateBotIdentity({
      botId: bySteamId.id,
      name: input.alias,
      accountName: input.accountName,
    });
  }
}
