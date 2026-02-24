import type { JobRepository } from "../interface/job-repository";
import type { JobRecord, JobStatus, JobTransitionRecord, JobType, TradeOfferCreateJobPayload } from "../type/job";
import { JobStateMachineService } from "./job-state-machine";
import type { DebugLogger } from "../../shared/type/debug-logger";

export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly stateMachine: JobStateMachineService,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("JobService", message, meta);
  }

  async enqueueTradeOffer(input: {
    payload: TradeOfferCreateJobPayload;
    maxAttempts?: number;
  }): Promise<JobRecord> {
    this.debug("enqueueTradeOffer:start", {
      fromBotName: input.payload.fromBotName,
      toBotName: input.payload.toBotName,
      sku: input.payload.sku,
      amount: input.payload.amount,
    });
    const maxAttempts = input.maxAttempts ?? 5;
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error("maxAttempts must be a positive integer");
    }
    const job = await this.repository.createJob({
      type: "TRADE_OFFER_CREATE",
      payload: input.payload,
      maxAttempts,
      nextRunAt: new Date(),
    });
    this.debug("enqueueTradeOffer:done", { jobId: job.id });
    return job;
  }

  async listJobs(input: {
    type?: JobType;
    status?: JobStatus;
    limit: number;
  }): Promise<JobRecord[]> {
    return this.repository.listJobs({
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
      limit: input.limit,
    });
  }

  async inspectJob(input: {
    jobId: string;
    transitionLimit: number;
  }): Promise<{ job: JobRecord; transitions: JobTransitionRecord[] }> {
    const job = await this.repository.findJobById(input.jobId);
    if (!job) {
      throw new Error(`Job not found: ${input.jobId}`);
    }
    const transitions = await this.repository.listTransitions(input.jobId, input.transitionLimit);
    return { job, transitions };
  }

  async retryJob(input: { jobId: string; actor: string; reasonMessage?: string }): Promise<JobRecord> {
    return this.stateMachine.retry({
      jobId: input.jobId,
      actor: input.actor,
      ...(input.reasonMessage ? { reasonMessage: input.reasonMessage } : {}),
    });
  }

  async cancelJob(input: { jobId: string; actor: string; reasonMessage?: string }): Promise<JobRecord> {
    return this.stateMachine.cancel({
      jobId: input.jobId,
      actor: input.actor,
      ...(input.reasonMessage ? { reasonMessage: input.reasonMessage } : {}),
    });
  }

  async getFailReason(jobId: string): Promise<{
    jobId: string;
    status: JobStatus;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    attemptCount: number;
    maxAttempts: number;
    updatedAt: Date;
  }> {
    const job = await this.repository.findJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return {
      jobId: job.id,
      status: job.status,
      lastErrorCode: job.lastErrorCode,
      lastErrorMessage: job.lastErrorMessage,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      updatedAt: job.updatedAt,
    };
  }
}
