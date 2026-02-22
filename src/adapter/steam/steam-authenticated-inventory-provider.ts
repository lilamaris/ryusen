import type {
  InventoryProvider,
} from "../../core/inventory/interface/inventory-provider";
import type { InventoryItem, InventoryItemAsset, InventoryQuery } from "../../core/inventory/type/inventory";
import { debugLog } from "../../debug";
import { toTf2Sku } from "./tf2-sku";

type SteamAsset = {
  classid: string;
  instanceid: string;
  assetid: string;
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

function toItems(assets: SteamAsset[], descriptions: SteamDescription[]): InventoryItem[] {
  const descriptionMap = createDescriptionMap(descriptions);
  type AggregatedItem = {
    quantity: number;
  iconUrl?: string | undefined;
    name: string;
    marketHashName: string;
    description: SteamDescription | null;
    assetEntries: InventoryItemAsset[];
  };

  const aggregated = new Map<string, AggregatedItem>();

  for (const asset of assets) {
    const itemKey = `${asset.classid}_${asset.instanceid}`;
    const description = descriptionMap.get(itemKey) ?? null;
    const quantity = Number(asset.amount);
    if (quantity <= 0) {
      continue;
    }

    const assetEntry: InventoryItemAsset = {
      assetId: asset.assetid,
      classId: asset.classid,
      instanceId: asset.instanceid,
      amount: quantity,
    };

    const existing = aggregated.get(itemKey);
    if (existing) {
      existing.quantity += quantity;
      existing.assetEntries.push(assetEntry);
      continue;
    }

    aggregated.set(itemKey, {
      quantity,
      assetEntries: [assetEntry],
      description,
      name: description?.name ?? "Unknown Item",
      marketHashName: description?.market_hash_name ?? "",
      iconUrl: description?.icon_url,
    });
  }

  const items = [];
  for (const [itemKey, data] of aggregated.entries()) {
    const item: InventoryItem = {
      key: itemKey,
      sku: toTf2Sku(data.description ?? null, itemKey),
      itemKey,
      name: data.name,
      marketHashName: data.marketHashName,
      quantity: data.quantity,
      rawPayload: {
        assets: data.assetEntries,
        description: data.description,
      },
    };
    if (data.iconUrl) {
      item.iconUrl = data.iconUrl;
    }
    items.push(item);
  }

  return items.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export class SteamAuthenticatedInventoryProvider implements InventoryProvider<InventoryQuery> {
  async listItems(query: InventoryQuery): Promise<InventoryItem[]> {
    debugLog("SteamAuthenticatedInventoryProvider", "listItems:start", {
      steamId: query.steamId,
      appId: query.appId,
      contextId: query.contextId,
      hasWebCookies: Boolean(query.webCookies && query.webCookies.length > 0),
      webCookiesCount: query.webCookies?.length ?? 0,
    });

    const allAssets: SteamAsset[] = [];
    const allDescriptions: SteamDescription[] = [];
    let startAssetId: string | null = null;
    let pageCount = 0;

    while (true) {
      const url = new URL(
        `https://steamcommunity.com/inventory/${query.steamId}/${query.appId}/${query.contextId}`
      );
      url.searchParams.set("l", "english");
      url.searchParams.set("count", "2000");
      if (startAssetId) {
        url.searchParams.set("start_assetid", startAssetId);
      }

      let response: Response;
      try {
        debugLog("SteamAuthenticatedInventoryProvider", "listItems:fetch", {
          url: url.toString(),
          hasCookieHeader: Boolean(query.webCookies && query.webCookies.length > 0),
        });
        if (query.webCookies && query.webCookies.length > 0) {
          response = await fetch(url, {
            headers: { Cookie: query.webCookies.join("; ") },
          });
        } else {
          response = await fetch(url);
        }
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "unknown network error";
        throw new Error(`Steam API network error (${url.toString()}): ${reason}`, { cause: error });
      }

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
      pageCount += 1;

      if (page.more_items === 1 && page.last_assetid) {
        startAssetId = page.last_assetid;
        continue;
      }

      break;
    }

    const items = toItems(allAssets, allDescriptions);
    debugLog("SteamAuthenticatedInventoryProvider", "listItems:done", {
      pageCount,
      assetCount: allAssets.length,
      descriptionCount: allDescriptions.length,
      itemCount: items.length,
    });
    return items;
  }
}
