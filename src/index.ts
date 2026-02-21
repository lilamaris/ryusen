import { Command } from "commander";
import { runCli } from "./cli";
import { runTui } from "./tui";
import { runWebServer } from "./web";
import type { SteamInventoryQuery } from "./steam";

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
    await runCli(getQueryOptions(options));
  });

program
  .command("tui")
  .requiredOption("--steam-id <steamId>", "SteamID64")
  .option("--app-id <appId>", "App ID", "730")
  .option("--context-id <contextId>", "Context ID", "2")
  .action(async (options: QueryOptions) => {
    await runTui(getQueryOptions(options));
  });

program
  .command("web")
  .option("--port <port>", "Web server port", "3000")
  .action(async (options: { port: string }) => {
    await runWebServer(Number(options.port));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
