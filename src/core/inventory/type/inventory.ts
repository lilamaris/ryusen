export type InventoryItemAsset = {
  assetId: string;
  classId: string;
  instanceId: string;
  amount: number;
};

export type InventoryItemRawPayload = {
  assets: InventoryItemAsset[];
  description: unknown;
};

export type InventoryItem = {
  key: string;
  itemKey: string;
  sku: string;
  name: string;
  marketHashName: string;
  quantity: number;
  iconUrl?: string;
  rawPayload: InventoryItemRawPayload;
};

export type InventoryQuery = {
  steamId: string;
  appId: number;
  contextId: string;
  webCookies?: string[];
};
