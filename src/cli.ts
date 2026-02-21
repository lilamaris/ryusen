import type { InventoryProvider } from "./inventory";
import type { SteamInventoryQuery } from "./steam";

export async function runCli(
  provider: InventoryProvider<SteamInventoryQuery>,
  query: SteamInventoryQuery
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
