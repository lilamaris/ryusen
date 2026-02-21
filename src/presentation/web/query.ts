import type { InventoryQuery } from "../../core/provider/inventory-provider";

export function getSingleQueryValue(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return fallback;
}

export function parseQuery(steamId: string, appId: string, contextId: string): InventoryQuery {
  return {
    steamId,
    appId: Number(appId),
    contextId,
  };
}
