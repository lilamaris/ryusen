import type { InventoryProvider, InventoryQuery } from "../core/provider/inventory-provider";

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
