import type { InventoryProvider } from "../core/provider/inventory-provider";
import type { SteamInventoryQuery } from "../adapter/steam/steam-inventory-provider";

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
