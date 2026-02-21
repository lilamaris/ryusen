import type { BotSessionRepository } from "../port/bot-session-repository";
import type { BotTradeOfferGateway, TradeOfferAsset } from "../port/bot-trade-offer-gateway";
import type { InventoryProvider, InventoryQuery, InventoryItem } from "../provider/inventory-provider";
import type { DebugLogger } from "./debug-logger";

export type BotTradeOfferResult = {
  tradeOfferId: string;
  offerUrl: string;
  fromBotName: string;
  toBotName: string;
  sku: string;
  requestedAmount: number;
};

export class BotTradeService {
  constructor(
    private readonly botSessionRepository: BotSessionRepository,
    private readonly inventoryProvider: InventoryProvider<InventoryQuery>,
    private readonly tradeOfferGateway: BotTradeOfferGateway,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("BotTradeService", message, meta);
  }

  async createOffer(input: {
    fromBotName: string;
    toBotName: string;
    toBotTradeToken?: string;
    appId: number;
    contextId: string;
    sku: string;
    amount: number;
    message?: string;
  }): Promise<BotTradeOfferResult> {
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isInteger(input.amount)) {
      throw new Error("amount must be a positive integer");
    }

    this.debug("createOffer:start", input);

    const fromBot = await this.botSessionRepository.findBotByName(input.fromBotName);
    if (!fromBot) {
      throw new Error(`Source bot not found: ${input.fromBotName}`);
    }

    const toBot = await this.botSessionRepository.findBotByName(input.toBotName);
    if (!toBot) {
      throw new Error(`Target bot not found: ${input.toBotName}`);
    }

    const normalizedInputToken = input.toBotTradeToken?.trim();
    const partnerTradeToken = normalizedInputToken ? normalizedInputToken : toBot.tradeToken ?? undefined;

    const session = await this.botSessionRepository.findSessionByBotId(fromBot.id);
    if (!session) {
      throw new Error(`Source bot has no authenticated session: ${input.fromBotName}`);
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new Error(`Source bot session is expired: ${input.fromBotName}`);
    }

    const inventory = await this.inventoryProvider.listItems({
      steamId: fromBot.steamId,
      appId: input.appId,
      contextId: input.contextId,
      webCookies: session.webCookies,
    });
    const targetItem = inventory.find((item) => item.sku === input.sku);
    if (!targetItem) {
      throw new Error(`Item ${input.sku} not found in ${input.fromBotName}'s inventory`);
    }

    const assets = this.selectAssets(targetItem, input.amount, input.appId, input.contextId);

    if (assets.length === 0) {
      throw new Error(`Insufficient quantity of ${input.sku} in ${input.fromBotName}'s inventory`);
    }

    const tradeParams = {
      partnerSteamId: toBot.steamId,
      ...(typeof partnerTradeToken === "string" ? { partnerTradeToken } : {}),
      sessionId: session.sessionToken,
      webCookies: session.webCookies,
      assets,
      ...(typeof input.message === "string" ? { message: input.message } : {}),
    };

    const result = await this.tradeOfferGateway.createTradeOffer(tradeParams);

    this.debug("createOffer:done", {
      fromBot: fromBot.name,
      toBot: toBot.name,
      tradeOfferId: result.tradeOfferId,
      sku: input.sku,
      amount: input.amount,
    });

    return {
      tradeOfferId: result.tradeOfferId,
      offerUrl: result.offerUrl,
      fromBotName: fromBot.name,
      toBotName: toBot.name,
      sku: input.sku,
      requestedAmount: input.amount,
    };
  }

  private selectAssets(item: InventoryItem, requiredAmount: number, appId: number, contextId: string): TradeOfferAsset[] {
    const payload = item.rawPayload;
    const assetEntries = payload.assets ?? [];
    const assets: TradeOfferAsset[] = [];
    let remaining = requiredAmount;

    for (const entry of assetEntries) {
      if (remaining <= 0) {
        break;
      }

      const take = Math.min(remaining, entry.amount);
      if (take <= 0) {
        continue;
      }

      assets.push({
        assetId: entry.assetId,
        appId,
        contextId,
        amount: take,
      });

      remaining -= take;
    }

    if (remaining > 0) {
      throw new Error(
        `Insufficient quantity of ${item.sku || "selected item"}: requested ${requiredAmount}, available ${
          requiredAmount - remaining
        }`
      );
    }

    return assets;
  }
}
