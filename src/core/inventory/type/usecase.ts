import type { InventoryQuery } from "./inventory";

export type RefreshAllResult = {
  totalBots: number;
  updatedBots: number;
  skippedBots: number;
  failedBots: number;
  errors: Array<{ botName: string; reason: string }>;
};

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

export type BotInventoryViewItem = {
  name: string;
  marketHashName: string;
  quantity: number;
  sku: string;
};

export type BotInventoryViewResult = {
  inventories: Array<{
    botName: string;
    items: BotInventoryViewItem[];
  }>;
  skipped: Array<{ botName: string; reason: InventorySkipReason }>;
  failures: Array<{ botName: string; reason: string }>;
};

export type ClusterStockResult = {
  appId: number;
  contextId: string;
  sku: string;
  totalAmount: number;
  holders: Array<{
    botId: string;
    botName: string;
    steamId: string;
    amount: number;
    lastSeenAt: Date;
  }>;
};
