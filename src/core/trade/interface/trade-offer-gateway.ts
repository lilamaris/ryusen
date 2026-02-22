import type { TradeOfferAsset } from "../type/trade";

export interface BotTradeOfferGateway {
  createTradeOffer(input: {
    partnerSteamId: string;
    partnerTradeToken?: string;
    sessionId: string;
    webCookies: string[];
    assets: TradeOfferAsset[];
    message?: string;
  }): Promise<{
    tradeOfferId: string;
    offerUrl: string;
  }>;
}
