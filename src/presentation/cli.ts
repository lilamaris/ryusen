import type { InventoryProvider, InventoryQuery } from "../core/provider/inventory-provider";

export type BotInventoryView = {
  botName: string;
  items: Array<{ name: string; marketHashName: string; quantity: number; sku: string }>;
};

export async function runCli(
  provider: InventoryProvider<InventoryQuery>,
  query: InventoryQuery
): Promise<void> {
  const items = await provider.listItems(query);

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
    console.log("No items found.");
    return;
  }

  console.table(rows);
}
