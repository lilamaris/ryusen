import express from "express";
import type { InventoryProvider } from "../../core/inventory/interface/inventory-provider";
import type { InventoryQuery } from "../../core/inventory/type/inventory";
import { debugLog } from "../../debug";
import { registerWebRoutes } from "./routes";

export async function runWebServer(
  provider: InventoryProvider<InventoryQuery>,
  port: number
): Promise<void> {
  debugLog("presentation/web", "runWebServer:start", { port });
  const app = express();
  registerWebRoutes(app, provider);

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      debugLog("presentation/web", "runWebServer:listening", { port });
      console.log(`Web UI running on http://localhost:${port}`);
      resolve();
    });
  });
}
