import type { BotInventoryRepository } from "../interface/inventory-repository";
import type { ClusterStockResult } from "../type/usecase";
import type { DebugLogger } from "../../shared/type/debug-logger";

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
