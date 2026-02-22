import type { InventoryProvider } from "../core/inventory/interface/inventory-provider";
import type { InventoryQuery } from "../core/inventory/type/inventory";
import { debugLog } from "../debug";

export type BotInventoryView = {
  botName: string;
  items: Array<{ name: string; marketHashName: string; quantity: number; sku: string }>;
};

export async function runCli(
  provider: InventoryProvider<InventoryQuery>,
  query: InventoryQuery
): Promise<void> {
  debugLog("presentation/cli", "runCli:start", {
    steamId: query.steamId,
    appId: query.appId,
    contextId: query.contextId,
  });
  const items = await provider.listItems(query);
  debugLog("presentation/cli", "runCli:fetched", { itemCount: items.length });

  if (items.length === 0) {
    console.log("No items found.");
    return;
  }

  console.table(
    items.map((item) => ({
      name: item.name,
      market: item.marketHashName,
      qty: item.quantity,
    }))
  );
}

export function renderCliByBots(inventories: BotInventoryView[]): void {
  debugLog("presentation/cli", "renderCliByBots:start", {
    botCount: inventories.length,
  });
  const rows = inventories.flatMap((inventory) =>
    inventory.items.map((item) => ({
      bot: inventory.botName,
      name: item.name,
      market: item.marketHashName,
      qty: item.quantity,
      sku: item.sku,
    }))
  );

  if (rows.length === 0) {
    debugLog("presentation/cli", "renderCliByBots:empty");
    console.log("No items found.");
    return;
  }

  debugLog("presentation/cli", "renderCliByBots:rows", { rowCount: rows.length });
  console.table(rows);
}
