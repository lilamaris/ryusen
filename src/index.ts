import { PrismaClient } from "@prisma/client";
import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PrismaBotSessionRepository } from "./adapter/persistence/prisma/prisma-bot-session-repository";
import { PrismaBotInventoryRepository } from "./adapter/persistence/prisma/prisma-bot-inventory-repository";
import { SteamSessionAuthGateway } from "./adapter/steam/steam-auth-gateway";
import { SteamAuthenticatedInventoryProvider } from "./adapter/steam/steam-authenticated-inventory-provider";
import { BotInventoryRefreshService } from "./core/usecase/bot-inventory-refresh-service";
import { BotInventoryQueryService, type InventorySkipReason } from "./core/usecase/bot-inventory-query-service";
import { BotSessionService } from "./core/usecase/bot-session-service";
import { renderCliByBots } from "./presentation/cli";
import { runTuiByBots } from "./presentation/tui";
import { runWebServer } from "./presentation/web";

type BotInventoryViewOptions = {
  name?: string;
  all?: boolean;
  appId: string;
  contextId: string;
  allowPublicFallback?: boolean;
};

type BotRegisterOptions = {
  name: string;
  steamId: string;
  accountName: string;
};

type BotAuthOptions = {
  name: string;
  steamId?: string;
  accountName?: string;
};

type SessionListOptions = {
  name?: string;
};

type BotRefreshOptions = {
  appId: string;
  contextId: string;
};

type BotRefreshLoopOptions = BotRefreshOptions & {
  intervalSeconds: string;
};

type BotItemHoldersOptions = BotRefreshOptions & {
  sku: string;
};

type BotInventoryFetchResult = {
  inventories: Array<{
    botName: string;
    items: Array<{ name: string; marketHashName: string; quantity: number; sku: string }>;
  }>;
  skipped: Array<{ botName: string; reason: InventorySkipReason }>;
  failures: Array<{ botName: string; reason: string }>;
};

function toSkipReasonText(reason: InventorySkipReason): string {
  if (reason === "bot_not_found") {
    return "bot not found";
  }
  if (reason === "no_session") {
    return "no session";
  }
  if (reason === "expired_session") {
    return "session expired";
  }
  return "missing web cookies";
}

function parseInventoryViewOptions(options: BotInventoryViewOptions): {
  appId: number;
  contextId: string;
  name: string | undefined;
  all: boolean;
  allowPublicFallback: boolean;
} {
  if (options.name && options.all) {
    throw new Error("Use either --name or --all, not both.");
  }

  if (!options.name && !options.all) {
    throw new Error("One of --name or --all is required.");
  }

  return {
    appId: Number(options.appId),
    contextId: options.contextId,
    name: options.name,
    all: Boolean(options.all),
    allowPublicFallback: Boolean(options.allowPublicFallback),
  };
}

async function fetchBotInventories(options: BotInventoryViewOptions): Promise<BotInventoryFetchResult> {
  const parsed = parseInventoryViewOptions(options);
  const resolved = parsed.all
    ? await botInventoryQueryService.resolveAllBots({
        appId: parsed.appId,
        contextId: parsed.contextId,
        allowPublicFallback: parsed.allowPublicFallback,
      })
    : await botInventoryQueryService.resolveByBotName({
        botName: parsed.name ?? "",
        appId: parsed.appId,
        contextId: parsed.contextId,
        allowPublicFallback: parsed.allowPublicFallback,
      });

  const inventories: BotInventoryFetchResult["inventories"] = [];
  const failures: BotInventoryFetchResult["failures"] = [];

  for (const target of resolved.targets) {
    try {
      const items = await steamProvider.listItems(target.query);
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

  return {
    inventories,
    skipped: resolved.skipped,
    failures,
  };
}

function printInventoryWarnings(result: BotInventoryFetchResult): void {
  if (result.skipped.length > 0) {
    console.table(
      result.skipped.map((item) => ({
        bot: item.botName,
        status: "skipped",
        reason: toSkipReasonText(item.reason),
      }))
    );
  }

  if (result.failures.length > 0) {
    console.table(
      result.failures.map((item) => ({
        bot: item.botName,
        status: "failed",
        reason: item.reason,
      }))
    );
  }
}

async function promptText(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

function buildPrompts() {
  return {
    requestGuardCode: async (message: string): Promise<string> => promptText(`${message}: `),
    notifyPendingConfirmation: async (message: string): Promise<void> => {
      await promptText(`${message} `);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRefreshOnce(options: BotRefreshOptions): Promise<void> {
  const result = await botInventoryRefreshService.refreshAll({
    appId: Number(options.appId),
    contextId: options.contextId,
  });

  console.table([
    {
      totalBots: result.totalBots,
      updatedBots: result.updatedBots,
      skippedBots: result.skippedBots,
      failedBots: result.failedBots,
    },
  ]);

  if (result.errors.length > 0) {
    console.table(result.errors);
  }
}

const program = new Command();
const steamProvider = new SteamAuthenticatedInventoryProvider();
const steamAuthGateway = new SteamSessionAuthGateway();
const prisma = new PrismaClient();
const botSessionRepository = new PrismaBotSessionRepository(prisma);
const botInventoryRepository = new PrismaBotInventoryRepository(prisma);
const botSessionService = new BotSessionService(botSessionRepository, steamAuthGateway);
const botInventoryRefreshService = new BotInventoryRefreshService(
  botSessionRepository,
  steamProvider,
  botInventoryRepository
);
const botInventoryQueryService = new BotInventoryQueryService(botSessionRepository);

program
  .name("ryusen")
  .description("Steam bot inventory and session manager")
  .showHelpAfterError();

const bot = program.command("bot").description("Mutating bot operations");
const ls = program.command("ls").description("List resources");
const view = program.command("view").description("Interactive and formatted inventory views");

bot
  .command("create")
  .requiredOption("--name <name>", "Bot name")
  .requiredOption("--steam-id <steamId>", "SteamID64")
  .requiredOption("--account-name <accountName>", "Steam login account name")
  .action(async (options: BotRegisterOptions) => {
    await botSessionService.registerBot({
      name: options.name,
      steamId: options.steamId,
      accountName: options.accountName,
    });
    console.log(`Bot registered: ${options.name}`);
  });

bot
  .command("connect")
  .requiredOption("--name <name>", "Bot name")
  .requiredOption("--steam-id <steamId>", "SteamID64")
  .requiredOption("--account-name <accountName>", "Steam login account name")
  .action(async (options: BotAuthOptions) => {
    const password = await promptText("Steam password: ");
    const prompts = buildPrompts();

    await botSessionService.addOrAuthenticateBot({
      name: options.name,
      steamId: options.steamId ?? "",
      accountName: options.accountName ?? "",
      password,
      prompts,
    });

    console.log(`Bot added and authenticated: ${options.name}`);
  });

bot
  .command("reauth")
  .requiredOption("--name <name>", "Bot name")
  .action(async (options: BotAuthOptions) => {
    const password = await promptText("Steam password: ");
    const prompts = buildPrompts();

    await botSessionService.reauthenticateBot({
      botName: options.name,
      password,
      prompts,
    });

    console.log(`Bot session refreshed: ${options.name}`);
  });

bot
  .command("refresh")
  .option("--app-id <appId>", "App ID", "440")
  .option("--context-id <contextId>", "Context ID", "2")
  .action(async (options: BotRefreshOptions) => {
    await runRefreshOnce(options);
  });

bot
  .command("watch")
  .option("--app-id <appId>", "App ID", "440")
  .option("--context-id <contextId>", "Context ID", "2")
  .option("--interval-seconds <intervalSeconds>", "Refresh interval in seconds", "120")
  .action(async (options: BotRefreshLoopOptions) => {
    const intervalMs = Number(options.intervalSeconds) * 1000;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new Error("--interval-seconds must be a positive number");
    }

    while (true) {
      await runRefreshOnce(options);
      await sleep(intervalMs);
    }
  });

ls
  .command("bots")
  .action(async () => {
    const bots = await botSessionRepository.listBots();
    if (bots.length === 0) {
      console.log("No bots found.");
      return;
    }

    console.table(
      bots.map((item) => ({
        name: item.name,
        steamId: item.steamId,
        accountName: item.accountName,
      }))
    );
  });

ls
  .command("sessions")
  .option("--name <name>", "Bot name (omit to list all bots)")
  .action(async (options: SessionListOptions) => {
    if (options.name) {
      const status = await botSessionService.checkBotSession(options.name);
      console.table([
        {
          bot: status.bot.name,
          steamId: status.bot.steamId,
          accountName: status.bot.accountName,
          hasSession: status.hasSession,
          isValid: status.isValid,
          expiresAt: status.expiresAt?.toISOString() ?? null,
          lastCheckedAt: status.lastCheckedAt?.toISOString() ?? null,
        },
      ]);
      return;
    }

    const statuses = await botSessionService.listBotSessions();
    console.table(
      statuses.map((status) => ({
        bot: status.bot.name,
        steamId: status.bot.steamId,
        accountName: status.bot.accountName,
        hasSession: status.hasSession,
        isValid: status.isValid,
        expiresAt: status.expiresAt?.toISOString() ?? null,
        lastCheckedAt: status.lastCheckedAt?.toISOString() ?? null,
      }))
    );
  });

ls
  .command("items")
  .requiredOption("--sku <sku>", "TF2-style SKU (defindex + attributes)")
  .option("--app-id <appId>", "App ID", "440")
  .option("--context-id <contextId>", "Context ID", "2")
  .action(async (options: BotItemHoldersOptions) => {
    const holders = await botInventoryRepository.listBotsBySku({
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

view
  .command("cli")
  .option("--name <name>", "Bot name")
  .option("--all", "Fetch inventories for all managed bots")
  .option("--app-id <appId>", "App ID", "730")
  .option("--context-id <contextId>", "Context ID", "2")
  .option("--allow-public-fallback", "If session is invalid, try public inventory query")
  .action(async (options: BotInventoryViewOptions) => {
    const result = await fetchBotInventories(options);
    renderCliByBots(result.inventories);
    printInventoryWarnings(result);
  });

view
  .command("tui")
  .option("--name <name>", "Bot name")
  .option("--all", "Fetch inventories for all managed bots")
  .option("--app-id <appId>", "App ID", "730")
  .option("--context-id <contextId>", "Context ID", "2")
  .option("--allow-public-fallback", "If session is invalid, try public inventory query")
  .action(async (options: BotInventoryViewOptions) => {
    const result = await fetchBotInventories(options);
    printInventoryWarnings(result);
    runTuiByBots(result.inventories);
  });

view
  .command("web")
  .option("--port <port>", "Web server port", "3000")
  .action(async (options: { port: string }) => {
    await runWebServer(steamProvider, Number(options.port));
  });

program
  .parseAsync(process.argv)
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
