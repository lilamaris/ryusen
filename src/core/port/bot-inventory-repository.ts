export type BotInventoryWriteItem = {
  appId: number;
  contextId: string;
  sku: string;
  itemKey: string;
  name: string;
  marketHashName: string;
  iconUrl?: string;
  amount: number;
  rawPayload: unknown;
  lastSeenAt: Date;
};

export type BotItemHolder = {
  botName: string;
  steamId: string;
  amount: number;
  lastSeenAt: Date;
};

export type BotSkuHolding = {
  botId: string;
  botName: string;
  steamId: string;
  amount: number;
  lastSeenAt: Date;
};

export interface BotInventoryRepository {
  replaceBotHoldings(botId: string, appId: number, contextId: string, items: BotInventoryWriteItem[]): Promise<void>;
  listBotsBySku(input: { appId: number; contextId: string; sku: string }): Promise<BotItemHolder[]>;
  listBotSkuHoldings(input: { appId: number; contextId: string; sku: string }): Promise<BotSkuHolding[]>;
}
