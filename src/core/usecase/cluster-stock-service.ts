import type { BotInventoryRepository } from "../port/bot-inventory-repository";
import type { DebugLogger } from "./debug-logger";

export type ClusterStockResult = {
  appId: number;
  contextId: string;
  sku: string;
  totalAmount: number;
  holders: Array<{
    botId: string;
    botName: string;
    steamId: string;
    amount: number;
    lastSeenAt: Date;
  }>;
};

export class ClusterStockService {
  constructor(
    private readonly inventoryRepository: BotInventoryRepository,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("ClusterStockService", message, meta);
  }

  async getStock(input: { appId: number; contextId: string; sku: string }): Promise<ClusterStockResult> {
    this.debug("getStock:start", input);

    const holders = await this.inventoryRepository.listBotSkuHoldings(input);
    const totalAmount = holders.reduce((sum, item) => sum + item.amount, 0);

    this.debug("getStock:done", {
      sku: input.sku,
      holderCount: holders.length,
      totalAmount,
    });

    return {
      ...input,
      totalAmount,
      holders,
    };
  }
}
