import type { BotInventoryRepository } from "../port/bot-inventory-repository";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { InventoryProvider, InventoryQuery } from "../provider/inventory-provider";
import type { DebugLogger } from "./debug-logger";

export type RefreshAllResult = {
  totalBots: number;
  updatedBots: number;
  skippedBots: number;
  failedBots: number;
  errors: Array<{ botName: string; reason: string }>;
};

export class BotInventoryRefreshService {
  constructor(
    private readonly sessions: BotSessionRepository,
    private readonly inventoryProvider: InventoryProvider<InventoryQuery>,
    private readonly inventoryRepository: BotInventoryRepository,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("BotInventoryRefreshService", message, meta);
  }

  async refreshAll(input: {
    appId: number;
    contextId: string;
    now?: Date;
  }): Promise<RefreshAllResult> {
    this.debug("refreshAll:start", {
      appId: input.appId,
      contextId: input.contextId,
    });

    const now = input.now ?? new Date();
    const rows = await this.sessions.listBotsWithSessions();
    this.debug("refreshAll:loadedBots", { count: rows.length });

    let updatedBots = 0;
    let skippedBots = 0;
    let failedBots = 0;
    const errors: Array<{ botName: string; reason: string }> = [];

    for (const row of rows) {
      if (!row.session || row.session.expiresAt.getTime() <= now.getTime() || row.session.webCookies.length === 0) {
        const reason = !row.session
          ? "no_session"
          : row.session.expiresAt.getTime() <= now.getTime()
            ? "expired_session"
            : "missing_web_cookies";
        this.debug("refreshAll:skip", {
          botName: row.bot.name,
          reason,
        });
        skippedBots += 1;
        continue;
      }

      try {
        this.debug("refreshAll:fetchStart", {
          botName: row.bot.name,
          appId: input.appId,
          contextId: input.contextId,
        });

        const fetchedItems = await this.inventoryProvider.listItems({
          steamId: row.bot.steamId,
          appId: input.appId,
          contextId: input.contextId,
          webCookies: row.session.webCookies,
        });

        this.debug("refreshAll:fetchDone", {
          botName: row.bot.name,
          itemCount: fetchedItems.length,
        });

        await this.inventoryRepository.replaceBotHoldings(
          row.bot.id,
          input.appId,
          input.contextId,
          fetchedItems.map((item) => ({
            ...(item.iconUrl ? { iconUrl: item.iconUrl } : {}),
            appId: input.appId,
            contextId: input.contextId,
            sku: item.sku,
            itemKey: item.itemKey,
            name: item.name,
            marketHashName: item.marketHashName,
            amount: item.quantity,
            rawPayload: item.rawPayload,
            lastSeenAt: now,
          }))
        );

        this.debug("refreshAll:stored", {
          botName: row.bot.name,
          itemCount: fetchedItems.length,
        });

        updatedBots += 1;
      } catch (error: unknown) {
        failedBots += 1;
        const reason = error instanceof Error ? error.message : String(error);
        errors.push({ botName: row.bot.name, reason });
        this.debug("refreshAll:failed", {
          botName: row.bot.name,
          reason,
        });
      }
    }

    this.debug("refreshAll:result", {
      totalBots: rows.length,
      updatedBots,
      skippedBots,
      failedBots,
    });

    return {
      totalBots: rows.length,
      updatedBots,
      skippedBots,
      failedBots,
      errors,
    };
  }
}
