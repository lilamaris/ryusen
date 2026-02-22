export interface SteamAsset {
  classid: string;
  instanceid: string;
  assetid: string;
  amount: string;
}

export interface SteamDescriptionTag {
  category?: string;
  internal_name?: string;
  localized_tag_name?: string;
  name?: string;
}

export interface SteamDescriptionEntry {
  value?: string;
}

export interface SteamDescription {
  classid: string;
  instanceid: string;
  name: string;
  market_hash_name?: string;
  icon_url?: string;
  app_data?: {
    def_index?: string;
  };
  tags?: SteamDescriptionTag[];
  descriptions?: SteamDescriptionEntry[];
}

export interface SteamInventoryPage {
  success: number;
  assets?: SteamAsset[];
  descriptions?: SteamDescription[];
  more_items?: number;
  last_assetid?: string;
}
