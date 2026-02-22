import type { InventoryItem } from "../type/inventory";

export interface InventoryProvider<TQuery> {
  listItems(query: TQuery): Promise<InventoryItem[]>;
}
