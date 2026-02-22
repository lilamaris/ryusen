import { debugLog } from "../../debug";
import type { BotTradeOfferGateway } from "../../core/trade/interface/trade-offer-gateway";

const STEAM_ID64_BASE = BigInt("76561197960265728");

type ParsedCookie = {
  name: string;
  value: string;
  domain: string | null;
};

function parseCookie(cookie: string): ParsedCookie | null {
  const parts = cookie.split(";").map((part) => part.trim());
  const first = parts[0];
  if (!first || !first.includes("=")) {
    return null;
  }

  const separator = first.indexOf("=");
  const name = first.slice(0, separator).trim();
  const value = first.slice(separator + 1);
  if (!name) {
    return null;
  }

  const domainPart = parts.find((part) => part.toLowerCase().startsWith("domain="));
  const domain = domainPart ? domainPart.slice("domain=".length).trim().toLowerCase() : null;

  return { name, value, domain };
}

function buildCookieHeader(webCookies: string[], sessionId: string): string {
  const entries = webCookies
    .map((cookie) => parseCookie(cookie))
    .filter((cookie): cookie is ParsedCookie => Boolean(cookie))
    .filter((cookie) => !cookie.domain || cookie.domain.includes("steamcommunity.com"));

  const byName = new Map<string, string>();
  for (const entry of entries) {
    byName.set(entry.name, entry.value);
  }

  if (!byName.has("sessionid")) {
    byName.set("sessionid", sessionId);
  }

  return [...byName.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function findCookieValue(cookieHeader: string, cookieName: string): string | null {
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${cookieName}=`)) {
      continue;
    }
    return part.slice(cookieName.length + 1);
  }
  return null;
}

function toPartnerAccountId(steamId: string): string {
  if (!/^\d+$/.test(steamId)) {
    throw new Error(`Invalid partner steamId: ${steamId}`);
  }

  const steamId64 = BigInt(steamId);
  if (steamId64 < STEAM_ID64_BASE) {
    throw new Error(`Invalid partner steamId: ${steamId}`);
  }

  return (steamId64 - STEAM_ID64_BASE).toString();
}

type TradeOfferSendInput = {
  partnerParam: string;
  partnerTradeToken?: string;
  sessionId: string;
  webCookies: string[];
  assets: Parameters<BotTradeOfferGateway["createTradeOffer"]>[0]["assets"];
  message?: string;
};

export class SteamTradeOfferGateway implements BotTradeOfferGateway {
  async createTradeOffer(input: {
    partnerSteamId: string;
    partnerTradeToken?: string;
    sessionId: string;
    webCookies: string[];
    assets: Parameters<BotTradeOfferGateway["createTradeOffer"]>[0]["assets"];
    message?: string;
  }): Promise<{ tradeOfferId: string; offerUrl: string }> {
    debugLog("SteamTradeOfferGateway", "createTradeOffer:start", {
      partnerSteamId: input.partnerSteamId,
      assetCount: input.assets.length,
    });

    const partnerAccountId = toPartnerAccountId(input.partnerSteamId);
    const partnerSteamId64 = input.partnerSteamId;
    const baseAttemptInput = {
      sessionId: input.sessionId,
      webCookies: input.webCookies,
      assets: input.assets,
      ...(typeof input.partnerTradeToken === "string"
        ? { partnerTradeToken: input.partnerTradeToken }
        : {}),
      ...(typeof input.message === "string" ? { message: input.message } : {}),
    };
    const firstAttempt = await this.sendTradeOffer({
      partnerParam: partnerAccountId,
      ...baseAttemptInput,
    });

    if (firstAttempt.ok) {
      return firstAttempt.result;
    }

    // Some accounts/envs behave differently for partner parameter; fallback once with SteamID64.
    if (firstAttempt.status === 400 || firstAttempt.status === 401) {
      const retryAttempt = await this.sendTradeOffer({
        partnerParam: partnerSteamId64,
        ...baseAttemptInput,
      });
      if (retryAttempt.ok) {
        return retryAttempt.result;
      }
      throw new Error(`Steam trade offer request failed: ${retryAttempt.status} ${retryAttempt.statusText}`);
    }

    throw new Error(`Steam trade offer request failed: ${firstAttempt.status} ${firstAttempt.statusText}`);
  }

  private async sendTradeOffer(
    input: TradeOfferSendInput
  ): Promise<
    | { ok: true; result: { tradeOfferId: string; offerUrl: string } }
    | { ok: false; status: number; statusText: string }
  > {
    const refererUrl = new URL("https://steamcommunity.com/tradeoffer/new/");
    refererUrl.searchParams.set("partner", input.partnerParam);
    if (input.partnerTradeToken) {
      refererUrl.searchParams.set("token", input.partnerTradeToken);
    }
    const payload = {
      newversion: true,
      version: 2,
      me: {
        assets: input.assets.map((asset) => ({
          appid: asset.appId,
          contextid: asset.contextId,
          amount: asset.amount,
          assetid: asset.assetId,
        })),
        currency: [],
        ready: false,
      },
      them: {
        assets: [],
        currency: [],
        ready: false,
      },
    };

    const form = new URLSearchParams();
    const cookieHeader = buildCookieHeader(input.webCookies, input.sessionId);
    const csrfSessionId = findCookieValue(cookieHeader, "sessionid") ?? input.sessionId;

    form.set("sessionid", csrfSessionId);
    form.set("serverid", "1");
    form.set("partner", input.partnerParam);
    form.set("tradeoffermessage", input.message ?? "");
    form.set("json_tradeoffer", JSON.stringify(payload));
    form.set("captcha", "");
    if (input.partnerTradeToken) {
      form.set("trade_offer_create_params", JSON.stringify({ trade_offer_access_token: input.partnerTradeToken }));
    } else {
      form.set("trade_offer_create_params", "{}");
    }

    const response = await fetch("https://steamcommunity.com/tradeoffer/new/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: refererUrl.toString(),
        Origin: "https://steamcommunity.com",
        Cookie: cookieHeader,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      debugLog("SteamTradeOfferGateway", "createTradeOffer:httpError", {
        partnerParam: input.partnerParam,
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      });
      return { ok: false, status: response.status, statusText: response.statusText };
    }

    const body = (await response.json()) as { tradeofferid?: string; strError?: string };
    if (!body.tradeofferid) {
      const message = body.strError ?? "Unknown error while creating trade offer";
      debugLog("SteamTradeOfferGateway", "createTradeOffer:failed", { message });
      throw new Error(message);
    }

    const result = {
      tradeOfferId: body.tradeofferid,
      offerUrl: `https://steamcommunity.com/tradeoffer/${body.tradeofferid}`,
    };

    debugLog("SteamTradeOfferGateway", "createTradeOffer:done", result);
    return { ok: true, result };
  }
}
