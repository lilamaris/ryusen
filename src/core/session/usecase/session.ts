import { getBotTradeReadiness, type Bot, type BotOnboardingState, type BotSessionStatus } from "../type/session";
import type { BotSessionRepository } from "../interface/session-repository";
import type { SteamAuthGateway } from "../interface/auth-gateway";
import type { SteamMobileAuthGateway } from "../interface/mobile-auth-gateway";
import type { SteamGuardPrompts } from "../type/auth";
import type {
  BotAuthenticatorBootstrapResult,
  BotDeclarationAccount,
  BotSecretSyncResult,
  BotSyncResult,
  BotTradeSecretsDeclaration,
} from "../type/usecase";
import type { DebugLogger } from "../../shared/type/debug-logger";

export class BotSessionService {
  constructor(
    private readonly repository: BotSessionRepository,
    private readonly steamAuthGateway: SteamAuthGateway,
    private readonly steamMobileAuthGateway?: SteamMobileAuthGateway,
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
      prompts: this.withGuardPromptContext(input.prompts, {
        mode: "connect",
        botName: input.name,
        steamId: input.steamId,
        accountName: input.accountName,
      }),
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

    if (!bot.sharedSecret && this.steamMobileAuthGateway) {
      await this.bootstrapTradeAuthenticator({
        botName: bot.name,
        password: input.password,
        prompts: input.prompts,
      });
      bot = (await this.repository.findBotBySteamId(input.steamId)) ?? bot;
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
      prompts: this.withGuardPromptContext(input.prompts, {
        mode: "reauth",
        botName: bot.name,
        steamId: bot.steamId,
        accountName: bot.accountName,
      }),
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

  async setBackpackAccessToken(input: { botName: string; accessToken: string }): Promise<void> {
    const accessToken = input.accessToken.trim();
    if (!accessToken) {
      throw new Error("accessToken must not be empty");
    }
    if (!this.repository.setBotBackpackAccessToken) {
      throw new Error("backpack integration storage is not configured");
    }

    this.debug("setBackpackAccessToken:start", { botName: input.botName });
    await this.repository.setBotBackpackAccessToken(input.botName, accessToken);
    this.debug("setBackpackAccessToken:done", { botName: input.botName });
  }

  async getBackpackAccessToken(botName: string): Promise<string> {
    if (!this.repository.findBotBackpackAccessToken) {
      throw new Error("backpack integration storage is not configured");
    }

    const token = await this.repository.findBotBackpackAccessToken(botName);
    if (!token) {
      throw new Error(`Backpack access token not configured for bot: ${botName}`);
    }

    return token;
  }

  async bootstrapTradeAuthenticator(input: {
    botName: string;
    password: string;
    prompts: SteamGuardPrompts;
  }): Promise<BotAuthenticatorBootstrapResult> {
    if (!this.steamMobileAuthGateway) {
      throw new Error("Steam mobile authenticator bootstrap gateway is not configured.");
    }

    const bot = await this.repository.findBotByName(input.botName);
    if (!bot) {
      throw new Error(`Bot not found: ${input.botName}`);
    }

    const contextualPrompts = this.withGuardPromptContext(input.prompts, {
      mode: "bootstrap-authenticator",
      botName: bot.name,
      steamId: bot.steamId,
      accountName: bot.accountName,
    });

    const bootstrap = await this.steamMobileAuthGateway.enableAndFinalizeTwoFactor({
      accountName: bot.accountName,
      password: input.password,
      prompts: contextualPrompts,
      requestActivationCode: (message: string) => contextualPrompts.requestGuardCode(message),
    });

    const onboardingStartedAt = new Date();
    const tradeLockedUntil = new Date(onboardingStartedAt.getTime() + 15 * 24 * 60 * 60 * 1000);
    const updated = await this.repository.setBotTradeSecretsBySteamId(bot.steamId, {
      sharedSecret: bootstrap.sharedSecret,
      identitySecret: bootstrap.identitySecret,
      revocationCode: bootstrap.revocationCode,
      onboardingState: "ONBOARDING_LOCKED",
      onboardingStartedAt,
      tradeLockedUntil,
    });

    return {
      botName: updated.name,
      steamId: updated.steamId,
      onboardingState: "ONBOARDING_LOCKED",
      tradable: false,
      tradeLockedUntil,
      revocationCode: bootstrap.revocationCode,
    };
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
        let bot = await this.ensureBotIdentity({
          alias,
          steamId,
          accountName,
        });

        const secrets = input.secretsBySteamId?.[steamId];
        if (secrets) {
          bot = await this.repository.setBotTradeSecretsBySteamId(steamId, {
            sharedSecret: secrets.sharedSecret?.trim() || null,
            identitySecret: secrets.identitySecret?.trim() || null,
            ...(bot.onboardingState === "ONBOARDING_LOCKED" && bot.tradeLockedUntil && bot.tradeLockedUntil > new Date()
              ? {}
              : { onboardingState: "AUTO_READY", tradeLockedUntil: null }),
          });
        } else if (!bot.sharedSecret && this.steamMobileAuthGateway) {
          const bootstrapResult = await this.bootstrapTradeAuthenticator({
            botName: bot.name,
            password,
            prompts: input.prompts,
          });
          this.debug("syncBotsFromDeclaration:bootstrappedSecrets", {
            botName: bot.name,
            tradeLockedUntil: bootstrapResult.tradeLockedUntil.toISOString(),
          });
          bot = (await this.repository.findBotBySteamId(steamId)) ?? bot;
        }

        const authResult = await this.steamAuthGateway.authenticateWithCredentials({
          accountName,
          password,
          prompts: this.withGuardPromptContext(input.prompts, {
            mode: "sync",
            botName: alias,
            steamId,
            accountName,
          }),
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
          ...(bot.onboardingState === "ONBOARDING_LOCKED" && bot.tradeLockedUntil && bot.tradeLockedUntil > new Date()
            ? {}
            : { onboardingState: "AUTO_READY", tradeLockedUntil: null }),
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

    const transitioned = await this.transitionOnboardingStateIfNeeded(bot, now);
    const status = await this.buildSessionStatus(transitioned, now);
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
      const transitioned = await this.transitionOnboardingStateIfNeeded(item.bot, now);
      if (!item.session) {
        statuses.push({
          bot: transitioned,
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
        bot: transitioned,
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

  async listBotsWithTradeReadiness(now: Date = new Date()): Promise<
    Array<{
      bot: Bot;
      onboardingState: BotOnboardingState;
      tradable: boolean;
    }>
  > {
    const bots = await this.repository.listBots();
    const rows: Array<{ bot: Bot; onboardingState: BotOnboardingState; tradable: boolean }> = [];

    for (const bot of bots) {
      const transitioned = await this.transitionOnboardingStateIfNeeded(bot, now);
      const readiness = getBotTradeReadiness(transitioned, now);
      rows.push({
        bot: transitioned,
        onboardingState: readiness.onboardingState,
        tradable: readiness.tradable,
      });
    }

    return rows;
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

  private async transitionOnboardingStateIfNeeded(bot: Bot, now: Date): Promise<Bot> {
    if (
      bot.onboardingState === "ONBOARDING_LOCKED" &&
      bot.tradeLockedUntil &&
      bot.tradeLockedUntil.getTime() <= now.getTime()
    ) {
      return this.repository.setBotOnboardingState({
        botId: bot.id,
        onboardingState: "AUTO_READY",
        tradeLockedUntil: bot.tradeLockedUntil,
      });
    }

    return bot;
  }

  private withGuardPromptContext(
    prompts: SteamGuardPrompts,
    context: {
      mode: "connect" | "reauth" | "sync" | "bootstrap-authenticator";
      botName: string;
      steamId: string;
      accountName: string;
    }
  ): SteamGuardPrompts {
    const header = [
      "",
      "+--------------------------------------------------+",
      "| Steam Guard Verification Required                |",
      "+--------------------------------------------------+",
      `| mode       : ${context.mode}`,
      `| bot        : ${context.botName}`,
      `| account    : ${context.accountName}`,
      `| steamId    : ${context.steamId}`,
      "+--------------------------------------------------+",
    ].join("\n");

    return {
      requestGuardCode: async (message: string): Promise<string> =>
        prompts.requestGuardCode(`${header}\n${message}`),
      notifyPendingConfirmation: async (message: string): Promise<void> =>
        prompts.notifyPendingConfirmation(`${header}\n${message}`),
    };
  }
}
