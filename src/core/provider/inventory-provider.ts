export type InventoryItem = {
  key: string;
  name: string;
  marketHashName: string;
  quantity: number;
  iconUrl?: string;
};

export type InventoryQuery = {
  steamId: string;
  appId: number;
  contextId: string;
};

export interface InventoryProvider<TQuery> {
  listItems(query: TQuery): Promise<InventoryItem[]>;
}
