import type { Command } from "commander";
import type { PrismaBotSessionRepository } from "../../adapter/persistence/prisma/prisma-bot-session-repository";
import type { PrismaTradeConsolidationRepository } from "../../adapter/persistence/prisma/prisma-trade-consolidation-repository";
import type { ControlBotConsolidationService } from "../../core/usecase/control-bot-consolidation-service";
import type { TradeConsolidationSettlementService } from "../../core/usecase/trade-consolidation-settlement-service";

type TradeConsolidateOptions = {
  controlName: string;
  sku: string;
  amount: string;
  appId: string;
  contextId: string;
};

type TradeJobsOptions = {
  limit: string;
};

type TradeLegCompleteOptions = {
  jobId: string;
  legId: string;
};

type TradeLegFailOptions = TradeLegCompleteOptions & {
  reason: string;
};

type RegisterTradeCommandDeps = {
  botSessionRepository: PrismaBotSessionRepository;
  tradeConsolidationRepository: PrismaTradeConsolidationRepository;
  controlBotConsolidationService: ControlBotConsolidationService;
  tradeConsolidationSettlementService: TradeConsolidationSettlementService;
};

export function registerTradeCommands(trade: Command, deps: RegisterTradeCommandDeps): void {
  trade
    .command("consolidate")
    .requiredOption("--control-name <controlName>", "Control bot name")
    .requiredOption("--sku <sku>", "TF2-style SKU (defindex + attributes)")
    .requiredOption("--amount <amount>", "Required amount to hold in control bot")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .action(async (options: TradeConsolidateOptions) => {
      const requiredAmount = Number(options.amount);
      const result = await deps.controlBotConsolidationService.createPlan({
        controlBotName: options.controlName,
        appId: Number(options.appId),
        contextId: options.contextId,
        sku: options.sku,
        requiredAmount,
      });

      console.table([
        {
          jobId: result.jobId,
          controlBot: result.controlBotName,
          sku: result.sku,
          requestedAmount: result.requestedAmount,
          controlCurrentAmount: result.controlCurrentAmount,
          totalClusterAmount: result.totalClusterAmount,
          status: result.status,
          legCount: result.legs.length,
        },
      ]);

      if (result.legs.length === 0) {
        console.log("Control bot already holds enough amount. No transfer legs were planned.");
        return;
      }

      console.table(
        result.legs.map((leg) => ({
          fromBot: leg.fromBotName,
          toBot: leg.toBotName,
          sku: leg.sku,
          amount: leg.amount,
        }))
      );

      console.log("Plan persisted as PLANNED. Execute transfers manually in Steam for now.");
    });

  trade
    .command("jobs")
    .option("--limit <limit>", "Max number of jobs", "20")
    .action(async (options: TradeJobsOptions) => {
      const jobs = await deps.tradeConsolidationRepository.listJobs({
        limit: Number(options.limit),
      });

      if (jobs.length === 0) {
        console.log("No trade consolidation jobs found.");
        return;
      }

      const bots = await deps.botSessionRepository.listBots();
      const botNameById = new Map(bots.map((bot) => [bot.id, bot.name]));

      console.table(
        jobs.map((job) => ({
          id: job.id,
          controlBot: botNameById.get(job.controlBotId) ?? job.controlBotId,
          sku: job.sku,
          requestedAmount: job.requestedAmount,
          status: job.status,
          failureReason: job.failureReason ?? "",
          legCount: job.legs.length,
          createdAt: job.createdAt.toISOString(),
        }))
      );
    });

  trade
    .command("leg-complete")
    .requiredOption("--job-id <jobId>", "Trade consolidation job ID")
    .requiredOption("--leg-id <legId>", "Trade consolidation leg ID")
    .action(async (options: TradeLegCompleteOptions) => {
      await deps.tradeConsolidationSettlementService.markLegCompleted({
        jobId: options.jobId,
        legId: options.legId,
      });
      console.log(`Leg marked as COMPLETED: ${options.legId}`);
    });

  trade
    .command("leg-fail")
    .requiredOption("--job-id <jobId>", "Trade consolidation job ID")
    .requiredOption("--leg-id <legId>", "Trade consolidation leg ID")
    .requiredOption("--reason <reason>", "Failure reason")
    .action(async (options: TradeLegFailOptions) => {
      await deps.tradeConsolidationSettlementService.markLegFailed({
        jobId: options.jobId,
        legId: options.legId,
        reason: options.reason,
      });
      console.log(`Leg marked as FAILED and job failed: ${options.legId}`);
    });
}
