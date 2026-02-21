export type AuthenticatedInventoryQuery = {
  steamId: string;
  appId: number;
  contextId: string;
  webCookies: string[];
};

export type AuthenticatedInventoryItem = {
  itemKey: string;
  name: string;
  marketHashName: string;
  quantity: number;
  iconUrl?: string;
  rawPayload: unknown;
};

export interface AuthenticatedInventoryProvider {
  listItems(query: AuthenticatedInventoryQuery): Promise<AuthenticatedInventoryItem[]>;
}
