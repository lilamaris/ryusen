import type { BotInventoryRepository } from "../port/bot-inventory-repository";
import type { BotSessionRepository } from "../port/bot-session-repository";
import type { InventoryProvider, InventoryQuery } from "../provider/inventory-provider";

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
    private readonly inventoryRepository: BotInventoryRepository
  ) {}

  async refreshAll(input: {
    appId: number;
    contextId: string;
    now?: Date;
  }): Promise<RefreshAllResult> {
    const now = input.now ?? new Date();
    const rows = await this.sessions.listBotsWithSessions();

    let updatedBots = 0;
    let skippedBots = 0;
    let failedBots = 0;
    const errors: Array<{ botName: string; reason: string }> = [];

    for (const row of rows) {
      if (!row.session || row.session.expiresAt.getTime() <= now.getTime() || row.session.webCookies.length === 0) {
        skippedBots += 1;
        continue;
      }

      try {
        const fetchedItems = await this.inventoryProvider.listItems({
          steamId: row.bot.steamId,
          appId: input.appId,
          contextId: input.contextId,
          webCookies: row.session.webCookies,
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

        updatedBots += 1;
      } catch (error: unknown) {
        failedBots += 1;
        const reason = error instanceof Error ? error.message : String(error);
        errors.push({ botName: row.bot.name, reason });
      }
    }

    return {
      totalBots: rows.length,
      updatedBots,
      skippedBots,
      failedBots,
      errors,
    };
  }
}
