import { PrismaClient } from "@prisma/client";
import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PrismaBotSessionRepository } from "./adapter/persistence/prisma/prisma-bot-session-repository";
import { PrismaBotInventoryRepository } from "./adapter/persistence/prisma/prisma-bot-inventory-repository";
import { SteamSessionAuthGateway } from "./adapter/steam/steam-auth-gateway";
import { SteamAuthenticatedInventoryProvider } from "./adapter/steam/steam-authenticated-inventory-provider";
import { SteamInventoryProvider } from "./adapter/steam/steam-inventory-provider";
import type { InventoryQuery } from "./core/provider/inventory-provider";
import { BotInventoryRefreshService } from "./core/usecase/bot-inventory-refresh-service";
import { BotSessionService } from "./core/usecase/bot-session-service";
import { runCli } from "./presentation/cli";
import { runTui } from "./presentation/tui";
import { runWebServer } from "./presentation/web";

type QueryOptions = {
  steamId: string;
  appId: string;
  contextId: string;
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

type BotCheckOptions = {
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
  itemKey: string;
};

function getQueryOptions(options: QueryOptions): InventoryQuery {
  if (!options.steamId) {
    throw new Error("--steam-id is required");
  }

  return {
    steamId: options.steamId,
    appId: Number(options.appId),
    contextId: options.contextId,
  };
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
const steamProvider = new SteamInventoryProvider();
const authenticatedInventoryProvider = new SteamAuthenticatedInventoryProvider();
const steamAuthGateway = new SteamSessionAuthGateway();
const prisma = new PrismaClient();
const botSessionRepository = new PrismaBotSessionRepository(prisma);
const botInventoryRepository = new PrismaBotInventoryRepository(prisma);
const botSessionService = new BotSessionService(botSessionRepository, steamAuthGateway);
const botInventoryRefreshService = new BotInventoryRefreshService(
  botSessionRepository,
  authenticatedInventoryProvider,
  botInventoryRepository
);

program
  .name("ryusen")
  .description("Steam inventory viewer")
  .showHelpAfterError();

program
  .command("cli")
  .requiredOption("--steam-id <steamId>", "SteamID64")
  .option("--app-id <appId>", "App ID", "730")
  .option("--context-id <contextId>", "Context ID", "2")
  .action(async (options: QueryOptions) => {
    await runCli(steamProvider, getQueryOptions(options));
  });

program
  .command("tui")
  .requiredOption("--steam-id <steamId>", "SteamID64")
  .option("--app-id <appId>", "App ID", "730")
  .option("--context-id <contextId>", "Context ID", "2")
  .action(async (options: QueryOptions) => {
    await runTui(steamProvider, getQueryOptions(options));
  });

program
  .command("web")
  .option("--port <port>", "Web server port", "3000")
  .action(async (options: { port: string }) => {
    await runWebServer(steamProvider, Number(options.port));
  });

const bot = program.command("bot").description("Manage bot accounts and sessions");

bot
  .command("register")
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
  .command("add")
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
  .command("auth")
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
  .command("session-check")
  .option("--name <name>", "Bot name (omit to check all bots)")
  .action(async (options: BotCheckOptions) => {
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

bot
  .command("refresh-once")
  .option("--app-id <appId>", "App ID", "440")
  .option("--context-id <contextId>", "Context ID", "2")
  .action(async (options: BotRefreshOptions) => {
    await runRefreshOnce(options);
  });

bot
  .command("refresh-loop")
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

bot
  .command("item-holders")
  .requiredOption("--item-key <itemKey>", "Item key (currently classid_instanceid)")
  .option("--app-id <appId>", "App ID", "440")
  .option("--context-id <contextId>", "Context ID", "2")
  .action(async (options: BotItemHoldersOptions) => {
    const holders = await botInventoryRepository.listBotsByItemKey({
      appId: Number(options.appId),
      contextId: options.contextId,
      itemKey: options.itemKey,
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
