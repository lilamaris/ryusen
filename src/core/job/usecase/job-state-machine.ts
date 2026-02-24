import type { JobRepository } from "../interface/job-repository";
import type { JobRecord } from "../type/job";
import type { DebugLogger } from "../../shared/type/debug-logger";

export class JobStateMachineService {
  constructor(
    private readonly repository: JobRepository,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("JobStateMachineService", message, meta);
  }

  async markCompleted(input: { jobId: string; actor: string }): Promise<JobRecord> {
    this.debug("markCompleted:start", input);
    const job = await this.repository.transitionJob({
      jobId: input.jobId,
      allowedFrom: ["RUNNING"],
      toStatus: "COMPLETED",
      actor: input.actor,
      reasonCode: "completed",
      patch: {
        completedAt: new Date(),
        claimExpiresAt: null,
        claimedBy: null,
      },
    });
    this.debug("markCompleted:done", { jobId: input.jobId });
    return job;
  }

  async markRetryWait(input: {
    jobId: string;
    actor: string;
    reasonCode: string;
    reasonMessage: string;
    nextRunAt: Date;
  }): Promise<JobRecord> {
    this.debug("markRetryWait:start", input);
    const job = await this.repository.transitionJob({
      jobId: input.jobId,
      allowedFrom: ["RUNNING"],
      toStatus: "RETRY_WAIT",
      actor: input.actor,
      reasonCode: input.reasonCode,
      reasonMessage: input.reasonMessage,
      patch: {
        nextRunAt: input.nextRunAt,
        claimExpiresAt: null,
        claimedBy: null,
        lastErrorCode: input.reasonCode,
        lastErrorMessage: input.reasonMessage,
      },
    });
    this.debug("markRetryWait:done", { jobId: input.jobId, nextRunAt: input.nextRunAt.toISOString() });
    return job;
  }

  async markFailed(input: {
    jobId: string;
    actor: string;
    reasonCode: string;
    reasonMessage: string;
  }): Promise<JobRecord> {
    this.debug("markFailed:start", input);
    const job = await this.repository.transitionJob({
      jobId: input.jobId,
      allowedFrom: ["RUNNING"],
      toStatus: "FAILED",
      actor: input.actor,
      reasonCode: input.reasonCode,
      reasonMessage: input.reasonMessage,
      patch: {
        claimExpiresAt: null,
        claimedBy: null,
        lastErrorCode: input.reasonCode,
        lastErrorMessage: input.reasonMessage,
      },
    });
    this.debug("markFailed:done", { jobId: input.jobId });
    return job;
  }

  async cancel(input: {
    jobId: string;
    actor: string;
    reasonCode?: string;
    reasonMessage?: string;
  }): Promise<JobRecord> {
    this.debug("cancel:start", input);
    const job = await this.repository.transitionJob({
      jobId: input.jobId,
      allowedFrom: ["PENDING", "RETRY_WAIT"],
      toStatus: "CANCELED",
      actor: input.actor,
      reasonCode: input.reasonCode ?? "canceled_by_operator",
      ...(input.reasonMessage ? { reasonMessage: input.reasonMessage } : {}),
      patch: {
        canceledAt: new Date(),
        claimExpiresAt: null,
        claimedBy: null,
      },
    });
    this.debug("cancel:done", { jobId: input.jobId });
    return job;
  }

  async retry(input: {
    jobId: string;
    actor: string;
    reasonCode?: string;
    reasonMessage?: string;
  }): Promise<JobRecord> {
    this.debug("retry:start", input);
    const job = await this.repository.transitionJob({
      jobId: input.jobId,
      allowedFrom: ["FAILED"],
      toStatus: "PENDING",
      actor: input.actor,
      reasonCode: input.reasonCode ?? "manual_retry",
      ...(input.reasonMessage ? { reasonMessage: input.reasonMessage } : {}),
      patch: {
        nextRunAt: new Date(),
        claimExpiresAt: null,
        claimedBy: null,
      },
    });
    this.debug("retry:done", { jobId: input.jobId });
    return job;
  }

  async recoverExpiredLease(input: {
    jobId: string;
    actor: string;
    now: Date;
  }): Promise<JobRecord> {
    this.debug("recoverExpiredLease:start", input);
    const job = await this.repository.transitionJob({
      jobId: input.jobId,
      allowedFrom: ["RUNNING"],
      toStatus: "RETRY_WAIT",
      actor: input.actor,
      reasonCode: "lease_expired",
      reasonMessage: "Worker lease expired while job was RUNNING.",
      patch: {
        nextRunAt: input.now,
        claimExpiresAt: null,
        claimedBy: null,
      },
    });
    this.debug("recoverExpiredLease:done", { jobId: input.jobId });
    return job;
  }
}
