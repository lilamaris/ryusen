import type { Express } from "express";
import type { InventoryProvider, InventoryQuery } from "../../core/provider/inventory-provider";
import { debugLog } from "../../debug";
import { getSingleQueryValue, parseQuery } from "./query";
import { pageTemplate } from "./template";

export function registerWebRoutes(app: Express, provider: InventoryProvider<InventoryQuery>): void {
  app.get("/", (_req, res) => {
    res.send(pageTemplate("<p>Load an inventory by filling the form.</p>"));
  });

  app.get("/inventory", async (req, res) => {
    debugLog("presentation/web", "inventory:request", {
      steamId: req.query.steamId,
      appId: req.query.appId,
      contextId: req.query.contextId,
    });

    const steamId = getSingleQueryValue(req.query.steamId, "").trim();
    const appId = getSingleQueryValue(req.query.appId, "730").trim();
    const contextId = getSingleQueryValue(req.query.contextId, "2").trim();

    if (!steamId) {
      debugLog("presentation/web", "inventory:badRequest", { reason: "missing steamId" });
      res.status(400).send(pageTemplate("<p>steamId is required.</p>"));
      return;
    }

    try {
      const query = parseQuery(steamId, appId, contextId);
      const items = await provider.listItems(query);
      debugLog("presentation/web", "inventory:fetched", { itemCount: items.length });
      const rows = items
        .map(
          (item) =>
            `<tr><td>${item.name}</td><td>${item.marketHashName}</td><td>${item.quantity}</td></tr>`
        )
        .join("");
      res.send(
        pageTemplate(
          `<table><thead><tr><th>Name</th><th>Market</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table>`
        )
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      debugLog("presentation/web", "inventory:failed", { message });
      res.status(500).send(pageTemplate(`<p>Failed to load inventory: ${message}</p>`));
    }
  });
}
