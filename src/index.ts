import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createAppContext } from "./app/bootstrap";
import { debugLog, setDebugEnabled } from "./debug";
import type { DebugLogger } from "./core/shared/type/debug-logger";
import { registerBotCommands } from "./presentation/command/bot";
import { registerLsCommands } from "./presentation/command/ls";
import { registerViewCommands } from "./presentation/command/view";

type BotRefreshOptions = {
  appId: string;
  contextId: string;
};

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
const debugEnabled = process.argv.includes("--debug");
setDebugEnabled(debugEnabled);
const debugLogger: DebugLogger = (scope, message, meta) => {
  debugLog(scope, message, meta);
};
const {
  prisma,
  steamProvider,
  botInventoryRepository,
  botSessionService,
  botInventoryRefreshService,
  botInventoryViewService,
  clusterStockService,
  botTradeService,
  marketPriceService,
} = createAppContext(debugLogger);

program
  .name("ryusen")
  .description("Steam bot inventory and session manager")
  .option("--debug", "Enable debug logs for command flow")
  .showHelpAfterError();

program.hook("preAction", (_thisCommand, actionCommand) => {
  debugLog("index", "command:start", {
    command: actionCommand.name(),
    args: actionCommand.args,
    opts: actionCommand.opts(),
  });
});

const bot = program.command("bot").description("Mutating bot operations");
const ls = program.command("ls").description("List resources");
const view = program.command("view").description("Interactive and formatted inventory views");

registerBotCommands(bot, {
  botSessionService,
  promptPassword: () => promptText("Steam password: "),
  buildPrompts,
  runRefreshOnce,
  sleep,
  botTradeService,
});

registerLsCommands(ls, {
  botSessionService,
  botInventoryRepository,
  clusterStockService,
  marketPriceService,
});

registerViewCommands(view, {
  steamProvider,
  botInventoryViewService,
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
