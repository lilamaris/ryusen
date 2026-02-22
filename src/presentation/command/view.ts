import type { Command } from "commander";
import type {
  BotInventoryViewService
} from "../../core/inventory/usecase/view";
import type { BotInventoryViewResult, InventorySkipReason } from "../../core/inventory/type/usecase";
import type { SteamAuthenticatedInventoryProvider } from "../../adapter/steam/steam-authenticated-inventory-provider";
import { renderCliByBots } from "../cli";
import { runTuiByBots } from "../tui";
import { runWebServer } from "../web/server";

type BotInventoryViewOptions = {
  name?: string;
  all?: boolean;
  appId: string;
  contextId: string;
  allowPublicFallback?: boolean;
};

type BotInventoryFetchResult = {
  inventories: BotInventoryViewResult["inventories"];
  skipped: BotInventoryViewResult["skipped"];
  failures: BotInventoryViewResult["failures"];
};

type RegisterViewCommandDeps = {
  steamProvider: SteamAuthenticatedInventoryProvider;
  botInventoryViewService: BotInventoryViewService;
};

export function registerViewCommands(view: Command, deps: RegisterViewCommandDeps): void {
  view
    .command("cli")
    .option("--name <name>", "Bot name")
    .option("--all", "Fetch inventories for all managed bots")
    .option("--app-id <appId>", "App ID", "730")
    .option("--context-id <contextId>", "Context ID", "2")
    .option("--allow-public-fallback", "If session is invalid, try public inventory query")
    .action(async (options: BotInventoryViewOptions) => {
      const result = await fetchBotInventories(deps.botInventoryViewService, options);
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
      const result = await fetchBotInventories(deps.botInventoryViewService, options);
      printInventoryWarnings(result);
      runTuiByBots(result.inventories);
    });

  view
    .command("web")
    .option("--port <port>", "Web server port", "3000")
    .action(async (options: { port: string }) => {
      await runWebServer(deps.steamProvider, Number(options.port));
    });
}

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
  botName?: string;
  all: boolean;
  allowPublicFallback: boolean;
} {
  return {
    appId: Number(options.appId),
    contextId: options.contextId,
    ...(options.name ? { botName: options.name } : {}),
    all: Boolean(options.all),
    allowPublicFallback: Boolean(options.allowPublicFallback),
  };
}

async function fetchBotInventories(
  botInventoryViewService: BotInventoryViewService,
  options: BotInventoryViewOptions
): Promise<BotInventoryFetchResult> {
  const parsed = parseInventoryViewOptions(options);
  return botInventoryViewService.fetchBySelection(parsed);
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
