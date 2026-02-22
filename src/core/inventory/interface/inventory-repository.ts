import type { BotInventoryWriteItem, BotItemHolder, BotSkuHolding } from "../type/holding";

export interface BotInventoryRepository {
  replaceBotHoldings(botId: string, appId: number, contextId: string, items: BotInventoryWriteItem[]): Promise<void>;
  listBotsBySku(input: { appId: number; contextId: string; sku: string }): Promise<BotItemHolder[]>;
  listBotSkuHoldings(input: { appId: number; contextId: string; sku: string }): Promise<BotSkuHolding[]>;
}
