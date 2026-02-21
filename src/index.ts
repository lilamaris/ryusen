import { PrismaClient } from "@prisma/client";
import { Command } from "commander";
import {
  SteamInventoryProvider,
  type SteamInventoryQuery,
} from "./adapter/steam/steam-inventory-provider";
import { PrismaBotSessionRepository } from "./adapter/persistence/prisma/prisma-bot-session-repository";
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
};

type BotConnectOptions = {
  name: string;
  sessionToken: string;
  expiresAt: string;
};

type BotCheckOptions = {
  name: string;
};

function getQueryOptions(options: QueryOptions): SteamInventoryQuery {
  if (!options.steamId) {
    throw new Error("--steam-id is required");
  }

  return {
    steamId: options.steamId,
    appId: Number(options.appId),
    contextId: options.contextId,
  };
}

function parseExpiresAt(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("--expires-at must be a valid ISO datetime (example: 2026-03-01T12:00:00Z)");
  }
  return parsed;
}

const program = new Command();
const steamProvider = new SteamInventoryProvider();
const prisma = new PrismaClient();
const botSessionRepository = new PrismaBotSessionRepository(prisma);
const botSessionService = new BotSessionService(botSessionRepository);

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
  .action(async (options: BotRegisterOptions) => {
    await botSessionService.registerBot({ name: options.name, steamId: options.steamId });
    console.log(`Bot registered: ${options.name}`);
  });

bot
  .command("connect")
  .requiredOption("--name <name>", "Bot name")
  .requiredOption("--session-token <token>", "Session token/cookie value")
  .requiredOption("--expires-at <isoDate>", "Session expiry as ISO datetime")
  .action(async (options: BotConnectOptions) => {
    await botSessionService.connectBot({
      botName: options.name,
      sessionToken: options.sessionToken,
      expiresAt: parseExpiresAt(options.expiresAt),
    });
    console.log(`Session saved for bot: ${options.name}`);
  });

bot
  .command("session-check")
  .requiredOption("--name <name>", "Bot name")
  .action(async (options: BotCheckOptions) => {
    const status = await botSessionService.checkBotSession(options.name);
    console.table([
      {
        bot: status.bot.name,
        steamId: status.bot.steamId,
        hasSession: status.hasSession,
        isValid: status.isValid,
        expiresAt: status.expiresAt?.toISOString() ?? null,
        lastCheckedAt: status.lastCheckedAt?.toISOString() ?? null,
      },
    ]);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
