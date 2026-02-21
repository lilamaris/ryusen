import type { Command } from "commander";
import type { BotSessionService } from "../../core/usecase/bot-session-service";
import type { SteamGuardPrompts } from "../../core/port/steam-auth-gateway";

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

type BotRefreshOptions = {
  appId: string;
  contextId: string;
};

type BotRefreshLoopOptions = BotRefreshOptions & {
  intervalSeconds: string;
};

type RegisterBotCommandDeps = {
  botSessionService: BotSessionService;
  promptPassword: () => Promise<string>;
  buildPrompts: () => SteamGuardPrompts;
  runRefreshOnce: (options: BotRefreshOptions) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
};

export function registerBotCommands(bot: Command, deps: RegisterBotCommandDeps): void {
  bot
    .command("create")
    .requiredOption("--name <name>", "Bot name")
    .requiredOption("--steam-id <steamId>", "SteamID64")
    .requiredOption("--account-name <accountName>", "Steam login account name")
    .action(async (options: BotRegisterOptions) => {
      await deps.botSessionService.registerBot({
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
      const password = await deps.promptPassword();
      const prompts = deps.buildPrompts();

      await deps.botSessionService.addOrAuthenticateBot({
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
      const password = await deps.promptPassword();
      const prompts = deps.buildPrompts();

      await deps.botSessionService.reauthenticateBot({
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
      await deps.runRefreshOnce(options);
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
        await deps.runRefreshOnce(options);
        await deps.sleep(intervalMs);
      }
    });
}
