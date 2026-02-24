import type { JobRepository } from "../interface/job-repository";
import type { JobRecord, JobType, TradeOfferCreateJobPayload } from "../type/job";
import { JobStateMachineService } from "./job-state-machine";
import type { DebugLogger } from "../../shared/type/debug-logger";

type JobHandlerContext = {
  jobId: string;
  attemptCount: number;
};

export type JobHandlerMap = {
  TRADE_OFFER_CREATE: (payload: TradeOfferCreateJobPayload, context: JobHandlerContext) => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableErrorMessage(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("timeout") ||
    text.includes("temporar") ||
    text.includes("network") ||
    text.includes("rate limit") ||
    text.includes("429") ||
    text.includes("5xx") ||
    text.includes("503") ||
    text.includes("session is expired") ||
    text.includes("unauthorized")
  );
}

function computeRetryDelayMs(attemptCount: number): number {
  const boundedAttempt = Math.max(1, Math.min(attemptCount, 6));
  return 1000 * 2 ** boundedAttempt;
}

export class JobWorkerService {
  constructor(
    private readonly repository: JobRepository,
    private readonly stateMachine: JobStateMachineService,
    private readonly handlers: JobHandlerMap,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("JobWorkerService", message, meta);
  }

  async runOnce(input: {
    workerId: string;
    limit: number;
    leaseMs: number;
    now?: Date;
  }): Promise<{ recovered: number; claimed: number; completed: number; retried: number; failed: number }> {
    const now = input.now ?? new Date();
    const actor = `worker:${input.workerId}`;
    this.debug("runOnce:start", {
      workerId: input.workerId,
      limit: input.limit,
      leaseMs: input.leaseMs,
      now: now.toISOString(),
    });

    const staleRunningJobs = await this.repository.listLeaseExpiredRunningJobs(now, input.limit);
    for (const staleJob of staleRunningJobs) {
      await this.stateMachine.recoverExpiredLease({
        jobId: staleJob.id,
        actor,
        now,
      });
    }

    const claimedJobs = await this.repository.claimRunnableJobs({
      workerId: input.workerId,
      now,
      limit: input.limit,
      leaseMs: input.leaseMs,
    });

    let completed = 0;
    let retried = 0;
    let failed = 0;

    for (const job of claimedJobs) {
      const result = await this.executeClaimedJob(job, actor, now);
      if (result === "completed") {
        completed += 1;
      } else if (result === "retried") {
        retried += 1;
      } else {
        failed += 1;
      }
    }

    this.debug("runOnce:done", {
      recovered: staleRunningJobs.length,
      claimed: claimedJobs.length,
      completed,
      retried,
      failed,
    });

    return {
      recovered: staleRunningJobs.length,
      claimed: claimedJobs.length,
      completed,
      retried,
      failed,
    };
  }

  private async executeClaimedJob(job: JobRecord, actor: string, now: Date): Promise<"completed" | "retried" | "failed"> {
    this.debug("executeClaimedJob:start", {
      jobId: job.id,
      type: job.type,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
    });

    try {
      await this.executeHandler(job.type, job.payload, {
        jobId: job.id,
        attemptCount: job.attemptCount,
      });
      await this.stateMachine.markCompleted({
        jobId: job.id,
        actor,
      });
      return "completed";
    } catch (error: unknown) {
      const message = toErrorMessage(error);
      const retryable = isRetryableErrorMessage(message);
      const exceededAttempts = job.attemptCount >= job.maxAttempts;

      if (retryable && !exceededAttempts) {
        const nextRunAt = new Date(now.getTime() + computeRetryDelayMs(job.attemptCount));
        await this.stateMachine.markRetryWait({
          jobId: job.id,
          actor,
          reasonCode: "retryable_error",
          reasonMessage: message,
          nextRunAt,
        });
        return "retried";
      }

      await this.stateMachine.markFailed({
        jobId: job.id,
        actor,
        reasonCode: exceededAttempts ? "max_attempts_exceeded" : "fatal_error",
        reasonMessage: message,
      });
      return "failed";
    }
  }

  private async executeHandler(type: JobType, payload: unknown, context: JobHandlerContext): Promise<void> {
    if (type === "TRADE_OFFER_CREATE") {
      await this.handlers.TRADE_OFFER_CREATE(payload as TradeOfferCreateJobPayload, context);
      return;
    }
    throw new Error(`No handler registered for job type: ${type}`);
  }
}
