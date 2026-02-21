export type TradeOfferAsset = {
  assetId: string;
  appId: number;
  contextId: string;
  amount: number;
};

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
