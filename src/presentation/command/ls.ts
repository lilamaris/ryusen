import type { Command } from "commander";
import type { PrismaBotInventoryRepository } from "../../adapter/prisma/inventory/inventory-repository";
import { getBotTradeAutomationMode, getBotTradeReadiness } from "../../core/session/type/session";
import type { ClusterStockService } from "../../core/inventory/usecase/stock";
import type { MarketPriceCurrencies } from "../../core/pricing/type/price";
import type { MarketPriceService } from "../../core/pricing/usecase/price";
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

type PriceOptions = {
  name: string;
  appId: string;
  contextId: string;
  sku: string;
  source: string;
  maxAgeSeconds: string;
};

type RegisterLsCommandDeps = {
  botSessionService: BotSessionService;
  botInventoryRepository: PrismaBotInventoryRepository;
  clusterStockService: ClusterStockService;
  marketPriceService: MarketPriceService;
};

function formatCurrencies(currencies: MarketPriceCurrencies): string {
  const parts: string[] = [];
  if (currencies.keys !== undefined) {
    parts.push(`${currencies.keys} keys`);
  }
  if (currencies.metal !== undefined) {
    parts.push(`${currencies.metal} ref`);
  }
  if (currencies.usd !== undefined) {
    parts.push(`$${currencies.usd}`);
  }
  return parts.length > 0 ? parts.join(" + ") : "-";
}

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
    .command("price")
    .requiredOption("--name <name>", "Bot name to select source access token")
    .requiredOption("--sku <sku>", "Market SKU to query from the selected source")
    .option("--source <source>", "Price source identifier", "backpack.tf")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .option("--max-age-seconds <maxAgeSeconds>", "Use cache when newer than this age (seconds)", "120")
    .action(async (options: PriceOptions) => {
      const accessToken = await deps.botSessionService.getBackpackAccessToken(options.name);
      const quote = await deps.marketPriceService.getPrice({
        source: options.source,
        appId: Number(options.appId),
        contextId: options.contextId,
        sku: options.sku,
        accessToken,
        maxAgeSeconds: Number(options.maxAgeSeconds),
      });

      console.table([
        {
          source: quote.source,
          appId: quote.appId,
          contextId: quote.contextId,
          sku: quote.sku,
          bestBuy: quote.bestBuy ? formatCurrencies(quote.bestBuy.currencies) : null,
          bestSell: quote.bestSell ? formatCurrencies(quote.bestSell.currencies) : null,
          buyListings: quote.bestBuy?.listingCount ?? 0,
          sellListings: quote.bestSell?.listingCount ?? 0,
          fetchedAt: quote.fetchedAt.toISOString(),
        },
      ]);
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
