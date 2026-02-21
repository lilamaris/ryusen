import type { Bot, BotSession } from "../bot/bot-session";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { InventoryQuery } from "../provider/inventory-provider";
import type { DebugLogger } from "./debug-logger";

export type InventorySkipReason = "bot_not_found" | "no_session" | "expired_session" | "missing_web_cookies";

export type InventoryQueryTarget = {
  botName: string;
  query: InventoryQuery;
};

export type SkippedBot = {
  botName: string;
  reason: InventorySkipReason;
};

export type ResolveInventoryTargetsResult = {
  targets: InventoryQueryTarget[];
  skipped: SkippedBot[];
};

function buildTarget(
  bot: Bot,
  session: BotSession | null,
  input: { appId: number; contextId: string; allowPublicFallback: boolean; now: Date }
): ResolveInventoryTargetsResult {
  if (!session) {
    if (!input.allowPublicFallback) {
      return { targets: [], skipped: [{ botName: bot.name, reason: "no_session" }] };
    }

    return {
      targets: [
        {
          botName: bot.name,
          query: {
            steamId: bot.steamId,
            appId: input.appId,
            contextId: input.contextId,
          },
        },
      ],
      skipped: [],
    };
  }

  if (session.expiresAt.getTime() <= input.now.getTime()) {
    if (!input.allowPublicFallback) {
      return { targets: [], skipped: [{ botName: bot.name, reason: "expired_session" }] };
    }

    return {
      targets: [
        {
          botName: bot.name,
          query: {
            steamId: bot.steamId,
            appId: input.appId,
            contextId: input.contextId,
          },
        },
      ],
      skipped: [],
    };
  }

  if (session.webCookies.length === 0) {
    if (!input.allowPublicFallback) {
      return { targets: [], skipped: [{ botName: bot.name, reason: "missing_web_cookies" }] };
    }

    return {
      targets: [
        {
          botName: bot.name,
          query: {
            steamId: bot.steamId,
            appId: input.appId,
            contextId: input.contextId,
          },
        },
      ],
      skipped: [],
    };
  }

  return {
    targets: [
      {
        botName: bot.name,
        query: {
          steamId: bot.steamId,
          appId: input.appId,
          contextId: input.contextId,
          webCookies: session.webCookies,
        },
      },
    ],
    skipped: [],
  };
}

export class BotInventoryQueryService {
  constructor(
    private readonly sessions: BotSessionRepository,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("BotInventoryQueryService", message, meta);
  }

  async resolveByBotName(input: {
    botName: string;
    appId: number;
    contextId: string;
    allowPublicFallback: boolean;
    now?: Date;
  }): Promise<ResolveInventoryTargetsResult> {
    this.debug("resolveByBotName:start", {
      botName: input.botName,
      appId: input.appId,
      contextId: input.contextId,
      allowPublicFallback: input.allowPublicFallback,
    });

    const now = input.now ?? new Date();
    const bot = await this.sessions.findBotByName(input.botName);
    if (!bot) {
      this.debug("resolveByBotName:skip", {
        botName: input.botName,
        reason: "bot_not_found",
      });
      return {
        targets: [],
        skipped: [{ botName: input.botName, reason: "bot_not_found" }],
      };
    }

    const session = await this.sessions.findSessionByBotId(bot.id);
    const result = buildTarget(bot, session, {
      appId: input.appId,
      contextId: input.contextId,
      allowPublicFallback: input.allowPublicFallback,
      now,
    });

    this.debug("resolveByBotName:result", {
      botName: input.botName,
      targetCount: result.targets.length,
      skipped: result.skipped,
    });

    return result;
  }

  async resolveAllBots(input: {
    appId: number;
    contextId: string;
    allowPublicFallback: boolean;
    now?: Date;
  }): Promise<ResolveInventoryTargetsResult> {
    this.debug("resolveAllBots:start", {
      appId: input.appId,
      contextId: input.contextId,
      allowPublicFallback: input.allowPublicFallback,
    });

    const now = input.now ?? new Date();
    const rows = await this.sessions.listBotsWithSessions();
    this.debug("resolveAllBots:loadedBots", { count: rows.length });

    const targets: InventoryQueryTarget[] = [];
    const skipped: SkippedBot[] = [];

    for (const row of rows) {
      const resolved = buildTarget(row.bot, row.session, {
        appId: input.appId,
        contextId: input.contextId,
        allowPublicFallback: input.allowPublicFallback,
        now,
      });
      targets.push(...resolved.targets);
      skipped.push(...resolved.skipped);

      this.debug("resolveAllBots:bot", {
        botName: row.bot.name,
        targetCount: resolved.targets.length,
        skipped: resolved.skipped,
      });
    }

    this.debug("resolveAllBots:result", {
      targetCount: targets.length,
      skippedCount: skipped.length,
    });

    return { targets, skipped };
  }
}
