import { Command } from "commander";
import {
  SteamInventoryProvider,
  type SteamInventoryQuery,
} from "./adapter/steam/steam-inventory-provider";
import { runCli } from "./presentation/cli";
import { runTui } from "./presentation/tui";
import { runWebServer } from "./presentation/web";

type QueryOptions = {
  steamId: string;
  appId: string;
  contextId: string;
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

const program = new Command();
const steamProvider = new SteamInventoryProvider();

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

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
