import assert from "node:assert/strict";
import test from "node:test";
import { BackpackTfPricer } from "./backpack-pricer";

const originalFetch = globalThis.fetch;

void test("getPrice extracts best buy/sell from backpack listings snapshot", async () => {
  let capturedAuthorization = "";
  globalThis.fetch = async (_url, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    capturedAuthorization = headers?.Authorization ?? "";
    return new Response(
      JSON.stringify({
        listings: [
          { intent: 0, currencies: { keys: 4, metal: 11 } },
          { intent: 0, currencies: { keys: 4, metal: 12 } },
          { intent: 1, currencies: { keys: 4, metal: 14 } },
          { intent: 1, currencies: { keys: 4, metal: 13 } },
        ],
      }),
      { status: 200 }
    );
  };

  const pricer = new BackpackTfPricer();
  const quote = await pricer.getPrice({
    appId: 440,
    contextId: "2",
    sku: "5021;6",
    accessToken: "bp-token",
  });

  assert.equal(quote.source, "backpack.tf");
  assert.equal(capturedAuthorization, "Token bp-token");
  assert.equal(quote.bestBuy?.listingCount, 2);
  assert.equal(quote.bestBuy?.currencies.metal, 12);
  assert.equal(quote.bestSell?.listingCount, 2);
  assert.equal(quote.bestSell?.currencies.metal, 13);
});

void test("getPrice throws when backpack response is not ok", async () => {
  globalThis.fetch = async (_url) => new Response("fail", { status: 503, statusText: "Service Unavailable" });

  const pricer = new BackpackTfPricer();
  await assert.rejects(
    () =>
      pricer.getPrice({
        appId: 440,
        contextId: "2",
        sku: "5021;6",
        accessToken: "bp-token",
      }),
    /backpack\.tf price request failed: 503 Service Unavailable/
  );
});

void test("getPrice throws when access token is missing", async () => {
  const pricer = new BackpackTfPricer();
  await assert.rejects(
    () =>
      pricer.getPrice({
        appId: 440,
        contextId: "2",
        sku: "5021;6",
      }),
    /backpack\.tf access token is required/
  );
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
