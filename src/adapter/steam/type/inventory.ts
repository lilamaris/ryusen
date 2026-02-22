import type { InventoryItemAsset } from "../../../core/inventory/type/inventory";
import type { SteamDescription } from "../type/steam-inventory";

export type AggregatedItem = {
  quantity: number;
  iconUrl: string | undefined;
  name: string;
  marketHashName: string;
  description: SteamDescription | null;
  assetEntries: InventoryItemAsset[];
};

export type SteamDescriptionLike = {
  name?: string;
  app_data?: {
    def_index?: string;
  };
  tags?: Array<{
    category?: string;
    internal_name?: string;
    localized_tag_name?: string;
    name?: string;
  }>;
  descriptions?: Array<{
    value?: string;
  }>;
};
