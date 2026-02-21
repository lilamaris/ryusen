export type BotInventoryWriteItem = {
  appId: number;
  contextId: string;
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

export interface BotInventoryRepository {
  replaceBotHoldings(botId: string, appId: number, contextId: string, items: BotInventoryWriteItem[]): Promise<void>;
  listBotsByItemKey(input: { appId: number; contextId: string; itemKey: string }): Promise<BotItemHolder[]>;
}
