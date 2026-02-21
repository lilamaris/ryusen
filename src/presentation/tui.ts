import blessed from "blessed";
import type { InventoryProvider, InventoryQuery } from "../core/provider/inventory-provider";
import type { BotInventoryView } from "./cli";

export async function runTui(
  provider: InventoryProvider<InventoryQuery>,
  query: InventoryQuery
): Promise<void> {
  const items = await provider.listItems(query);

  const screen = blessed.screen({ smartCSR: true, title: "Steam Inventory" });
  const table = blessed.listtable({
    parent: screen,
    width: "100%",
    height: "100%",
    align: "left",
    border: "line",
    keys: true,
    mouse: true,
    vi: true,
    style: {
      header: { bold: true },
      cell: { selected: { bg: "blue" } },
      border: { fg: "cyan" },
    },
    data: [
      ["Name", "Market", "Qty"],
      ...items.map((item) => [item.name, item.marketHashName, String(item.quantity)]),
    ],
  });

  const help = blessed.box({
    parent: screen,
    bottom: 0,
    left: 1,
    height: 1,
    content: "q or Ctrl+C to quit",
  });

  screen.key(["q", "C-c"], () => process.exit(0));
  table.focus();
  help.setFront();
  screen.render();
}

export function runTuiByBots(inventories: BotInventoryView[]): void {
  const rows = inventories.flatMap((inventory) =>
    inventory.items.map((item) => [inventory.botName, item.name, item.marketHashName, String(item.quantity), item.sku])
  );

  if (rows.length === 0) {
    console.log("No items found.");
    return;
  }

  const screen = blessed.screen({ smartCSR: true, title: "Steam Inventory" });
  const table = blessed.listtable({
    parent: screen,
    width: "100%",
    height: "100%",
    align: "left",
    border: "line",
    keys: true,
    mouse: true,
    vi: true,
    style: {
      header: { bold: true },
      cell: { selected: { bg: "blue" } },
      border: { fg: "cyan" },
    },
    data: [["Bot", "Name", "Market", "Qty", "SKU"], ...rows],
  });

  const help = blessed.box({
    parent: screen,
    bottom: 0,
    left: 1,
    height: 1,
    content: "q or Ctrl+C to quit",
  });

  screen.key(["q", "C-c"], () => process.exit(0));
  table.focus();
  help.setFront();
  screen.render();
}
