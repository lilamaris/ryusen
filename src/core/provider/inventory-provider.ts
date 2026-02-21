export type InventoryItem = {
  key: string;
  itemKey: string;
  sku: string;
  name: string;
  marketHashName: string;
  quantity: number;
  iconUrl?: string;
  rawPayload: unknown;
};

export type InventoryQuery = {
  steamId: string;
  appId: number;
  contextId: string;
  webCookies?: string[];
};

export interface InventoryProvider<TQuery> {
  listItems(query: TQuery): Promise<InventoryItem[]>;
}
