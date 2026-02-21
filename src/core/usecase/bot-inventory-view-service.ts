import type { InventoryProvider, InventoryQuery } from "../provider/inventory-provider";
import type {
  BotInventoryQueryService,
  InventorySkipReason,
  ResolveInventoryTargetsResult,
} from "./bot-inventory-query-service";
import type { DebugLogger } from "./debug-logger";

export type BotInventoryViewItem = {
  name: string;
  marketHashName: string;
  quantity: number;
  sku: string;
};

export type BotInventoryViewResult = {
  inventories: Array<{
    botName: string;
    items: BotInventoryViewItem[];
  }>;
  skipped: Array<{ botName: string; reason: InventorySkipReason }>;
  failures: Array<{ botName: string; reason: string }>;
};

type ResolveInput = {
  botName?: string;
  all?: boolean;
  appId: number;
  contextId: string;
  allowPublicFallback?: boolean;
};

type InventoryTargetResolver = Pick<BotInventoryQueryService, "resolveByBotName" | "resolveAllBots">;

export class BotInventoryViewService {
  constructor(
    private readonly targetResolver: InventoryTargetResolver,
    private readonly provider: InventoryProvider<InventoryQuery>,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("BotInventoryViewService", message, meta);
  }

  async fetchBySelection(input: ResolveInput): Promise<BotInventoryViewResult> {
    if (input.botName && input.all) {
      throw new Error("Use either --name or --all, not both.");
    }
    if (!input.botName && !input.all) {
      throw new Error("One of --name or --all is required.");
    }

    this.debug("fetchBySelection:start", {
      botName: input.botName ?? null,
      all: Boolean(input.all),
      appId: input.appId,
      contextId: input.contextId,
      allowPublicFallback: Boolean(input.allowPublicFallback),
    });

    const resolved = await this.resolveTargets(input);
    const inventories: BotInventoryViewResult["inventories"] = [];
    const failures: BotInventoryViewResult["failures"] = [];

    for (const target of resolved.targets) {
      try {
        const items = await this.provider.listItems(target.query);
        inventories.push({
          botName: target.botName,
          items: items.map((item) => ({
            name: item.name,
            marketHashName: item.marketHashName,
            quantity: item.quantity,
            sku: item.sku,
          })),
        });
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ botName: target.botName, reason });
      }
    }

    this.debug("fetchBySelection:done", {
      inventoryCount: inventories.length,
      skippedCount: resolved.skipped.length,
      failureCount: failures.length,
    });

    return {
      inventories,
      skipped: resolved.skipped,
      failures,
    };
  }

  private resolveTargets(input: ResolveInput): Promise<ResolveInventoryTargetsResult> {
    if (input.all) {
      return this.targetResolver.resolveAllBots({
        appId: input.appId,
        contextId: input.contextId,
        allowPublicFallback: Boolean(input.allowPublicFallback),
      });
    }

    return this.targetResolver.resolveByBotName({
      botName: input.botName ?? "",
      appId: input.appId,
      contextId: input.contextId,
      allowPublicFallback: Boolean(input.allowPublicFallback),
    });
  }
}
