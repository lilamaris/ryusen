import type { BotSessionRepository } from "../port/bot-session-repository";
import type { TradeConsolidationRepository } from "../port/trade-consolidation-repository";
import { ClusterStockService } from "./cluster-stock-service";
import type { DebugLogger } from "./debug-logger";

export type ConsolidationPlanLeg = {
  fromBotName: string;
  fromBotId: string;
  toBotName: string;
  toBotId: string;
  sku: string;
  amount: number;
};

export type ConsolidationPlanResult = {
  jobId: string;
  controlBotName: string;
  controlBotId: string;
  appId: number;
  contextId: string;
  sku: string;
  requestedAmount: number;
  controlCurrentAmount: number;
  totalClusterAmount: number;
  status: "PLANNED";
  legs: ConsolidationPlanLeg[];
};

export class ControlBotConsolidationService {
  constructor(
    private readonly botSessionRepository: BotSessionRepository,
    private readonly clusterStockService: ClusterStockService,
    private readonly tradeConsolidationRepository: TradeConsolidationRepository,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("ControlBotConsolidationService", message, meta);
  }

  async createPlan(input: {
    controlBotName: string;
    appId: number;
    contextId: string;
    sku: string;
    requiredAmount: number;
  }): Promise<ConsolidationPlanResult> {
    if (input.requiredAmount <= 0 || !Number.isInteger(input.requiredAmount)) {
      throw new Error("requiredAmount must be a positive integer");
    }

    this.debug("createPlan:start", input);

    const controlBot = await this.botSessionRepository.findBotByName(input.controlBotName);
    if (!controlBot) {
      throw new Error(`Control bot not found: ${input.controlBotName}`);
    }

    const stock = await this.clusterStockService.getStock({
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
    });

    if (stock.totalAmount < input.requiredAmount) {
      throw new Error(
        `Insufficient cluster stock for sku=${input.sku}: required=${input.requiredAmount}, available=${stock.totalAmount}`
      );
    }

    const controlHolding = stock.holders.find((item) => item.botId === controlBot.id);
    const controlCurrentAmount = controlHolding?.amount ?? 0;
    const needFromOthers = Math.max(0, input.requiredAmount - controlCurrentAmount);
    const legs = this.planLegs(controlBot.id, controlBot.name, stock.holders, input.sku, needFromOthers);

    const savedJob = await this.tradeConsolidationRepository.createPlannedJob({
      controlBotId: controlBot.id,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      requestedAmount: input.requiredAmount,
      status: "PLANNED",
      legs: legs.map((item) => ({
        fromBotId: item.fromBotId,
        toBotId: item.toBotId,
        sku: item.sku,
        amount: item.amount,
        status: "PLANNED",
      })),
    });

    if (needFromOthers > 0 && savedJob.legs.length === 0) {
      throw new Error("Consolidation plan generation failed: no donor legs were produced.");
    }

    this.debug("createPlan:done", {
      jobId: savedJob.id,
      legsCount: legs.length,
      totalClusterAmount: stock.totalAmount,
      controlCurrentAmount,
      needFromOthers,
    });

    return {
      jobId: savedJob.id,
      controlBotName: controlBot.name,
      controlBotId: controlBot.id,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      requestedAmount: input.requiredAmount,
      controlCurrentAmount,
      totalClusterAmount: stock.totalAmount,
      status: "PLANNED",
      legs,
    };
  }

  private planLegs(
    controlBotId: string,
    controlBotName: string,
    holders: Array<{ botId: string; botName: string; amount: number }>,
    sku: string,
    neededAmount: number
  ): ConsolidationPlanLeg[] {
    if (neededAmount === 0) {
      return [];
    }

    const donors = holders
      .filter((item) => item.botId !== controlBotId && item.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.botName.localeCompare(b.botName));

    let remaining = neededAmount;
    const legs: ConsolidationPlanLeg[] = [];

    for (const donor of donors) {
      if (remaining <= 0) {
        break;
      }
      const take = Math.min(remaining, donor.amount);
      if (take <= 0) {
        continue;
      }
      legs.push({
        fromBotName: donor.botName,
        fromBotId: donor.botId,
        toBotName: controlBotName,
        toBotId: controlBotId,
        sku,
        amount: take,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      throw new Error(`Consolidation plan generation failed: missing ${remaining} item(s) after donor allocation.`);
    }

    return legs;
  }
}
