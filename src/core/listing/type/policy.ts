export type ListingSource = "backpack.tf";

export type ListingPolicy = {
  id: string;
  source: ListingSource;
  appId: number;
  contextId: string;
  sku: string;
  enabled: boolean;
  minMarginBps: number;
  maxExposure: number;
  targetBotName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertListingPolicyInput = {
  source: ListingSource;
  appId: number;
  contextId: string;
  sku: string;
  minMarginBps: number;
  maxExposure: number;
  targetBotName: string;
};
