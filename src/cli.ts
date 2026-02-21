import { fetchSteamInventory, type SteamInventoryQuery } from "./steam";

export async function runCli(query: SteamInventoryQuery): Promise<void> {
  const items = await fetchSteamInventory(query);

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
