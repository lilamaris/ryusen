import type { BotTradeOfferGateway } from "../../../core/trade/interface/trade-offer-gateway";

export type ParsedCookie = {
  name: string;
  value: string;
  domain: string | null;
};

export type TradeOfferSendInput = {
  partnerParam: string;
  partnerTradeToken?: string;
  sessionId: string;
  webCookies: string[];
  assets: Parameters<BotTradeOfferGateway["createTradeOffer"]>[0]["assets"];
  message?: string;
};
