import assert from "node:assert/strict";
import test from "node:test";
import { SteamTradeOfferGateway } from "./steam-trade-offer-gateway";

const originalFetch = globalThis.fetch;

void test("createTradeOffer normalizes cookie header and sends ajax headers", async () => {
  let capturedCookie = "";
  let capturedRequestedWith = "";
  let capturedBody = "";
  globalThis.fetch = async (_url, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    capturedCookie = headers?.Cookie ?? "";
    capturedRequestedWith = headers?.["X-Requested-With"] ?? "";
    capturedBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ tradeofferid: "123" }), { status: 200 });
  };

  const gateway = new SteamTradeOfferGateway();
  await gateway.createTradeOffer({
    partnerSteamId: "76561198072587653",
    sessionId: "sid-input",
    webCookies: [
      "steamLoginSecure=abc; Path=/; Secure; Domain=steamcommunity.com",
      "sessionid=sid-store; Path=/; Secure; Domain=store.steampowered.com",
      "sessionid=sid-1; Path=/; Secure; Domain=steamcommunity.com",
      "steamCountry=US; Path=/; Domain=steamcommunity.com",
    ],
    assets: [{ assetId: "a1", appId: 440, contextId: "2", amount: 1 }],
  });

  assert.equal(capturedCookie, "steamLoginSecure=abc; sessionid=sid-1; steamCountry=US");
  assert.equal(capturedRequestedWith, "XMLHttpRequest");
  const decodedBody = decodeURIComponent(capturedBody);
  assert.match(decodedBody, /partner=112321925/);
  assert.match(decodedBody, /sessionid=sid-1/);
  assert.match(decodedBody, /trade_offer_create_params=\{\}/);
});

void test("createTradeOffer includes recipient trade token in request", async () => {
  let capturedBody = "";
  let capturedReferer = "";
  globalThis.fetch = async (_url, init) => {
    capturedBody = String(init?.body ?? "");
    const headers = init?.headers as Record<string, string> | undefined;
    capturedReferer = headers?.Referer ?? "";
    return new Response(JSON.stringify({ tradeofferid: "456" }), { status: 200 });
  };

  const gateway = new SteamTradeOfferGateway();
  await gateway.createTradeOffer({
    partnerSteamId: "76561198072587653",
    partnerTradeToken: "trade-token",
    sessionId: "sid-2",
    webCookies: ["steamLoginSecure=abc"],
    assets: [{ assetId: "a1", appId: 440, contextId: "2", amount: 1 }],
  });

  assert.match(capturedReferer, /token=trade-token/);
  const decodedBody = decodeURIComponent(capturedBody);
  assert.match(decodedBody, /trade_offer_create_params=\{"trade_offer_access_token":"trade-token"\}/);
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
