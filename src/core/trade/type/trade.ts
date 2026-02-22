export type TradeOfferAsset = {
  assetId: string;
  appId: number;
  contextId: string;
  amount: number;
};

export type BotTradeOfferResult = {
  tradeOfferId: string;
  offerUrl: string;
  fromBotName: string;
  toBotName: string;
  sku: string;
  requestedAmount: number;
};
