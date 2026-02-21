import type { TradeConsolidationRepository } from "../port/trade-consolidation-repository";
import type { DebugLogger } from "./debug-logger";

export class TradeConsolidationSettlementService {
  constructor(
    private readonly tradeConsolidationRepository: TradeConsolidationRepository,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("TradeConsolidationSettlementService", message, meta);
  }

  async markLegCompleted(input: { jobId: string; legId: string }): Promise<void> {
    this.debug("markLegCompleted:start", input);
    const job = await this.tradeConsolidationRepository.findJobById(input.jobId);
    if (!job) {
      throw new Error(`Trade consolidation job not found: ${input.jobId}`);
    }
    if (job.status !== "PLANNED") {
      throw new Error(`Only PLANNED jobs can be updated: ${input.jobId} (${job.status})`);
    }

    const leg = job.legs.find((item) => item.id === input.legId);
    if (!leg) {
      throw new Error(`Trade consolidation leg not found in job: ${input.legId}`);
    }
    if (leg.status !== "PLANNED") {
      throw new Error(`Only PLANNED legs can be marked completed: ${input.legId} (${leg.status})`);
    }

    await this.tradeConsolidationRepository.updateLegStatus({
      legId: input.legId,
      status: "COMPLETED",
    });

    const remainingPlannedLegs = job.legs.filter((item) => item.id !== input.legId && item.status === "PLANNED");
    if (remainingPlannedLegs.length === 0) {
      await this.tradeConsolidationRepository.updateJobStatus({
        jobId: input.jobId,
        status: "COMPLETED",
      });
    }

    this.debug("markLegCompleted:done", {
      jobId: input.jobId,
      legId: input.legId,
      remainingPlannedLegs: remainingPlannedLegs.length,
    });
  }

  async markLegFailed(input: { jobId: string; legId: string; reason: string }): Promise<void> {
    this.debug("markLegFailed:start", input);
    const job = await this.tradeConsolidationRepository.findJobById(input.jobId);
    if (!job) {
      throw new Error(`Trade consolidation job not found: ${input.jobId}`);
    }
    if (job.status !== "PLANNED") {
      throw new Error(`Only PLANNED jobs can be updated: ${input.jobId} (${job.status})`);
    }

    const leg = job.legs.find((item) => item.id === input.legId);
    if (!leg) {
      throw new Error(`Trade consolidation leg not found in job: ${input.legId}`);
    }
    if (leg.status !== "PLANNED") {
      throw new Error(`Only PLANNED legs can be marked failed: ${input.legId} (${leg.status})`);
    }

    await this.tradeConsolidationRepository.updateLegStatus({
      legId: input.legId,
      status: "FAILED",
    });
    await this.tradeConsolidationRepository.updateJobStatus({
      jobId: input.jobId,
      status: "FAILED",
      failureReason: input.reason,
    });

    this.debug("markLegFailed:done", {
      jobId: input.jobId,
      legId: input.legId,
      reason: input.reason,
    });
  }
}
