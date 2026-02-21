export type SteamInventoryQuery = {
  steamId: string;
  appId: number;
  contextId: string;
};

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
};

type SteamInventoryPage = {
  success: number;
  assets?: SteamAsset[];
  descriptions?: SteamDescription[];
  more_items?: number;
  last_assetid?: string;
};

export type InventoryItem = {
  key: string;
  name: string;
  marketHashName: string;
  quantity: number;
  iconUrl?: string;
};

function createDescriptionMap(descriptions: SteamDescription[]): Map<string, SteamDescription> {
  const map = new Map<string, SteamDescription>();
  for (const description of descriptions) {
    map.set(`${description.classid}_${description.instanceid}`, description);
  }
  return map;
}

function toInventoryItems(assets: SteamAsset[], descriptions: SteamDescription[]): InventoryItem[] {
  const descriptionMap = createDescriptionMap(descriptions);
  const itemMap = new Map<string, InventoryItem>();

  for (const asset of assets) {
    const key = `${asset.classid}_${asset.instanceid}`;
    const found = itemMap.get(key);
    if (found) {
      found.quantity += Number(asset.amount);
      continue;
    }

    const description = descriptionMap.get(key);
    const item: InventoryItem = {
      key,
      name: description?.name ?? "Unknown Item",
      marketHashName: description?.market_hash_name ?? "",
      quantity: Number(asset.amount),
    };

    if (description?.icon_url) {
      item.iconUrl = description.icon_url;
    }

    itemMap.set(key, item);
  }

  return [...itemMap.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export async function fetchSteamInventory(query: SteamInventoryQuery): Promise<InventoryItem[]> {
  const allAssets: SteamAsset[] = [];
  const allDescriptions: SteamDescription[] = [];
  let startAssetId: string | null = null;

  while (true) {
    const url = new URL(`https://steamcommunity.com/inventory/${query.steamId}/${query.appId}/${query.contextId}`);
    url.searchParams.set("l", "english");
    url.searchParams.set("count", "2000");
    if (startAssetId) {
      url.searchParams.set("start_assetid", startAssetId);
    }

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "unknown network error";
      throw new Error(`Steam API network error (${url.toString()}): ${reason}`, { cause: error });
    }
    if (!response.ok) {
      throw new Error(`Steam API request failed: ${response.status} ${response.statusText}`);
    }

    const page = (await response.json()) as SteamInventoryPage;
    if (page.success !== 1) {
      throw new Error("Steam API returned unsuccessful response.");
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

  return toInventoryItems(allAssets, allDescriptions);
}
