import type { Command } from "commander";
import type { PrismaBotInventoryRepository } from "../../adapter/persistence/prisma/prisma-bot-inventory-repository";
import { getBotTradeAutomationMode, getBotTradeReadiness } from "../../core/session/type/session";
import type { ClusterStockService } from "../../core/inventory/usecase/stock";
import type { BotSessionService } from "../../core/session/usecase/session";

type SessionListOptions = {
  name?: string;
};

type BotItemHoldersOptions = {
  appId: string;
  contextId: string;
  sku: string;
};

type StockOptions = {
  appId: string;
  contextId: string;
  sku: string;
};

type RegisterLsCommandDeps = {
  botSessionService: BotSessionService;
  botInventoryRepository: PrismaBotInventoryRepository;
  clusterStockService: ClusterStockService;
};

export function registerLsCommands(ls: Command, deps: RegisterLsCommandDeps): void {
  ls.command("bots").action(async () => {
    const bots = await deps.botSessionService.listBotsWithTradeReadiness();
    if (bots.length === 0) {
      console.log("No bots found.");
      return;
    }

    console.table(
      bots.map((item) => ({
        name: item.bot.name,
        steamId: item.bot.steamId,
        accountName: item.bot.accountName,
        hasTradeToken: Boolean(item.bot.tradeToken),
        tradeAutomation: getBotTradeAutomationMode(item.bot),
        onboardingState: item.onboardingState,
        tradable: item.tradable,
        tradeLockedUntil: item.bot.tradeLockedUntil?.toISOString() ?? null,
      }))
    );
  });

  ls
    .command("sessions")
    .option("--name <name>", "Bot name (omit to list all bots)")
    .action(async (options: SessionListOptions) => {
      if (options.name) {
        const status = await deps.botSessionService.checkBotSession(options.name);
        console.table([
          {
            bot: status.bot.name,
            steamId: status.bot.steamId,
            accountName: status.bot.accountName,
            hasSession: status.hasSession,
            isValid: status.isValid,
            tradeAutomation: getBotTradeAutomationMode(status.bot),
            onboardingState: status.bot.onboardingState ?? null,
            tradable: getBotTradeReadiness(status.bot).tradable,
            tradeLockedUntil: status.bot.tradeLockedUntil?.toISOString() ?? null,
            expiresAt: status.expiresAt?.toISOString() ?? null,
            lastCheckedAt: status.lastCheckedAt?.toISOString() ?? null,
          },
        ]);
        return;
      }

      const statuses = await deps.botSessionService.listBotSessions();
      console.table(
        statuses.map((status) => ({
          bot: status.bot.name,
          steamId: status.bot.steamId,
          accountName: status.bot.accountName,
          hasSession: status.hasSession,
          isValid: status.isValid,
          tradeAutomation: getBotTradeAutomationMode(status.bot),
          onboardingState: status.bot.onboardingState ?? null,
          tradable: getBotTradeReadiness(status.bot).tradable,
          tradeLockedUntil: status.bot.tradeLockedUntil?.toISOString() ?? null,
          expiresAt: status.expiresAt?.toISOString() ?? null,
          lastCheckedAt: status.lastCheckedAt?.toISOString() ?? null,
        }))
      );
    });

  ls
    .command("stock")
    .requiredOption("--sku <sku>", "TF2-style SKU (defindex + attributes)")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .action(async (options: StockOptions) => {
      const stock = await deps.clusterStockService.getStock({
        appId: Number(options.appId),
        contextId: options.contextId,
        sku: options.sku,
      });

      console.table([
        {
          appId: stock.appId,
          contextId: stock.contextId,
          sku: stock.sku,
          totalAmount: stock.totalAmount,
          holderCount: stock.holders.length,
        },
      ]);

      if (stock.holders.length === 0) {
        console.log("No bots hold this item.");
        return;
      }

      console.table(
        stock.holders.map((holder) => ({
          bot: holder.botName,
          steamId: holder.steamId,
          amount: holder.amount,
          lastSeenAt: holder.lastSeenAt.toISOString(),
        }))
      );
    });

  ls
    .command("items")
    .requiredOption("--sku <sku>", "TF2-style SKU (defindex + attributes)")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .action(async (options: BotItemHoldersOptions) => {
      const holders = await deps.botInventoryRepository.listBotsBySku({
        appId: Number(options.appId),
        contextId: options.contextId,
        sku: options.sku,
      });

      if (holders.length === 0) {
        console.log("No bots hold this item.");
        return;
      }

      console.table(
        holders.map((holder) => ({
          bot: holder.botName,
          steamId: holder.steamId,
          amount: holder.amount,
          lastSeenAt: holder.lastSeenAt.toISOString(),
        }))
      );
    });
}
