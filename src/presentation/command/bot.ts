import type { Command } from "commander";
import type { BotTradeService } from "../../core/usecase/bot-trade-service";
import type { BotSessionService } from "../../core/usecase/bot-session-service";
import type { SteamGuardPrompts } from "../../core/port/steam-auth-gateway";
import { loadBotAccountDeclarationFromYaml, loadBotSecretsDeclarationFromYaml } from "./bot-sync-yaml";

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

type BotTradeOptions = {
  from: string;
  to: string;
  toTradeToken?: string;
  sku: string;
  amount: string;
  appId: string;
  contextId: string;
  message?: string;
};

type BotTradeTokenOptions = {
  name: string;
  token: string;
};

type BotSyncOptions = {
  fromYamlFile: string;
  secretsYamlFile?: string;
};

type RegisterBotCommandDeps = {
  botSessionService: BotSessionService;
  promptPassword: () => Promise<string>;
  buildPrompts: () => SteamGuardPrompts;
  runRefreshOnce: (options: BotRefreshOptions) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  botTradeService: BotTradeService;
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
    .command("set-trade-token")
    .requiredOption("--name <name>", "Bot name")
    .requiredOption("--token <token>", "Trade offer token from Steam trade URL")
    .action(async (options: BotTradeTokenOptions) => {
      await deps.botSessionService.setTradeToken({
        botName: options.name,
        tradeToken: options.token,
      });
      console.log(`Bot trade token updated: ${options.name}`);
    });

  bot
    .command("sync")
    .requiredOption("--from-yaml-file <path>", "Bot account YAML file path")
    .option("--secrets-yaml-file <path>", "Bot secret YAML file path")
    .action(async (options: BotSyncOptions) => {
      const accounts = await loadBotAccountDeclarationFromYaml(options.fromYamlFile);
      const secretsBySteamId = options.secretsYamlFile
        ? await loadBotSecretsDeclarationFromYaml(options.secretsYamlFile)
        : undefined;

      const result = await deps.botSessionService.syncBotsFromDeclaration({
        accounts,
        prompts: deps.buildPrompts(),
        ...(secretsBySteamId ? { secretsBySteamId } : {}),
      });

      console.table(result.rows);
      console.table([
        {
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
        },
      ]);
    });

  bot
    .command("sync-secrets")
    .requiredOption("--from-yaml-file <path>", "Bot secret YAML file path")
    .action(async (options: BotSyncOptions) => {
      const secretsBySteamId = await loadBotSecretsDeclarationFromYaml(options.fromYamlFile);
      const result = await deps.botSessionService.syncBotSecretsFromDeclaration({
        secretsBySteamId,
      });

      console.table(result.rows);
      console.table([
        {
          total: result.total,
          updated: result.updated,
          failed: result.failed,
        },
      ]);
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

  bot
    .command("trade")
    .requiredOption("--from <from>", "Source bot name")
    .requiredOption("--to <to>", "Target bot name")
    .option("--to-trade-token <toTradeToken>", "Recipient bot trade-offer token")
    .requiredOption("--sku <sku>", "TF2-style SKU (defindex + attributes)")
    .requiredOption("--amount <amount>", "Quantity to send")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .option("--message <message>", "Optional message for the trade offer")
    .action(async (options: BotTradeOptions) => {
      const tradeInput = {
        fromBotName: options.from,
        toBotName: options.to,
        ...(options.toTradeToken ? { toBotTradeToken: options.toTradeToken } : {}),
        appId: Number(options.appId),
        contextId: options.contextId,
        sku: options.sku,
        amount: Number(options.amount),
        ...(options.message ? { message: options.message } : {}),
      };
      const result = await deps.botTradeService.createOffer(tradeInput);

      console.table([
        {
          tradeOfferId: result.tradeOfferId,
          from: result.fromBotName,
          to: result.toBotName,
          sku: result.sku,
          amount: result.requestedAmount,
        },
      ]);
      console.log(`Trade offer created: ${result.offerUrl}`);
    });
}
