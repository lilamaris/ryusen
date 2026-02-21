import express from "express";
import { fetchSteamInventory, type SteamInventoryQuery } from "./steam";

function pageTemplate(content: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Steam Inventory Viewer</title>
  <style>
    body { font-family: sans-serif; margin: 24px; }
    form { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 8px; margin-bottom: 16px; }
    input, button { padding: 8px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
  <h1>Steam Inventory Viewer</h1>
  <form method="get" action="/inventory">
    <input name="steamId" placeholder="SteamID64" required />
    <input name="appId" placeholder="App ID" value="730" required />
    <input name="contextId" placeholder="Context ID" value="2" required />
    <button type="submit">Load</button>
  </form>
  ${content}
</body>
</html>`;
}

function getSingleQueryValue(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return fallback;
}

function parseQuery(steamId: string, appId: string, contextId: string): SteamInventoryQuery {
  return {
    steamId,
    appId: Number(appId),
    contextId,
  };
}

export async function runWebServer(port: number): Promise<void> {
  const app = express();

  app.get("/", (_req, res) => {
    res.send(pageTemplate("<p>Load an inventory by filling the form.</p>"));
  });

  app.get("/inventory", async (req, res) => {
    const steamId = getSingleQueryValue(req.query.steamId, "").trim();
    const appId = getSingleQueryValue(req.query.appId, "730").trim();
    const contextId = getSingleQueryValue(req.query.contextId, "2").trim();

    if (!steamId) {
      res.status(400).send(pageTemplate("<p>steamId is required.</p>"));
      return;
    }

    try {
      const query = parseQuery(steamId, appId, contextId);
      const items = await fetchSteamInventory(query);
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
      res.status(500).send(pageTemplate(`<p>Failed to load inventory: ${message}</p>`));
    }
  });

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Web UI running on http://localhost:${port}`);
      resolve();
    });
  });
}
