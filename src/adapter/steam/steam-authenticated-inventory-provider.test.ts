import assert from "node:assert/strict";
import test from "node:test";
import { SteamAuthenticatedInventoryProvider } from "./steam-authenticated-inventory-provider";

const originalFetch = globalThis.fetch;

void test("listItems keeps aggregated asset entries in rawPayload", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: 1,
        assets: [
          { assetid: "a1", classid: "101", instanceid: "0", amount: "1" },
          { assetid: "a2", classid: "101", instanceid: "0", amount: "1" },
        ],
        descriptions: [
          {
            classid: "101",
            instanceid: "0",
            name: "Sample Item",
            market_hash_name: "Sample Item",
          },
        ],
      }),
      { status: 200 }
    );

  const provider = new SteamAuthenticatedInventoryProvider();
  const items = await provider.listItems({
    steamId: "76561198000000000",
    appId: 440,
    contextId: "2",
    webCookies: ["sessionid=abc"],
  });

  assert.equal(items.length, 1);
  const payload = items[0]?.rawPayload;
  assert.ok(payload);
  assert.ok(Array.isArray(payload.assets));
  const assetIds = payload.assets.map((asset) => asset.assetId);
  assert.deepEqual(assetIds, ["a1", "a2"]);
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
