import type {
  AuthenticatedInventoryItem,
  AuthenticatedInventoryProvider,
  AuthenticatedInventoryQuery,
} from "../../core/port/authenticated-inventory-provider";
import { toTf2Sku } from "./tf2-sku";

type SteamAsset = {
  classid: string;
  instanceid: string;
  amount: string;
};

type SteamDescription = {
  classid: string;
  instanceid: string;
  name: string;
  market_hash_name?: string;
  icon_url?: string;
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

type SteamInventoryPage = {
  success: number;
  assets?: SteamAsset[];
  descriptions?: SteamDescription[];
  more_items?: number;
  last_assetid?: string;
};

function createDescriptionMap(descriptions: SteamDescription[]): Map<string, SteamDescription> {
  const map = new Map<string, SteamDescription>();
  for (const description of descriptions) {
    map.set(`${description.classid}_${description.instanceid}`, description);
  }
  return map;
}

function toItems(assets: SteamAsset[], descriptions: SteamDescription[]): AuthenticatedInventoryItem[] {
  const descriptionMap = createDescriptionMap(descriptions);
  const itemMap = new Map<string, AuthenticatedInventoryItem>();

  for (const asset of assets) {
    const itemKey = `${asset.classid}_${asset.instanceid}`;
    const found = itemMap.get(itemKey);
    if (found) {
      found.quantity += Number(asset.amount);
      continue;
    }

    const description = descriptionMap.get(itemKey);
    const item: AuthenticatedInventoryItem = {
      sku: toTf2Sku(description ?? null, itemKey),
      itemKey,
      name: description?.name ?? "Unknown Item",
      marketHashName: description?.market_hash_name ?? "",
      quantity: Number(asset.amount),
      rawPayload: {
        asset,
        description: description ?? null,
      },
    };

    if (description?.icon_url) {
      item.iconUrl = description.icon_url;
    }

    itemMap.set(itemKey, item);
  }

  return [...itemMap.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export class SteamAuthenticatedInventoryProvider implements AuthenticatedInventoryProvider {
  async listItems(query: AuthenticatedInventoryQuery): Promise<AuthenticatedInventoryItem[]> {
    const allAssets: SteamAsset[] = [];
    const allDescriptions: SteamDescription[] = [];
    let startAssetId: string | null = null;

    while (true) {
      const url = new URL(
        `https://steamcommunity.com/inventory/${query.steamId}/${query.appId}/${query.contextId}`
      );
      url.searchParams.set("l", "english");
      url.searchParams.set("count", "2000");
      if (startAssetId) {
        url.searchParams.set("start_assetid", startAssetId);
      }

      const response = await fetch(url, {
        headers: {
          Cookie: query.webCookies.join("; "),
        },
      });

      if (!response.ok) {
        throw new Error(`Steam inventory request failed: ${response.status} ${response.statusText}`);
      }

      const page = (await response.json()) as SteamInventoryPage;
      if (page.success !== 1) {
        throw new Error("Steam inventory API returned unsuccessful response.");
      }

      if (page.assets) {
        allAssets.push(...page.assets);
      }
      if (page.descriptions) {
        allDescriptions.push(...page.descriptions);
      }

      if (page.more_items === 1 && page.last_assetid) {
        startAssetId = page.last_assetid;
        continue;
      }

      break;
    }

    return toItems(allAssets, allDescriptions);
  }
}
