import type { Command } from "commander";
import type { JobService } from "../../core/job/usecase/job";
import type { JobWorkerService } from "../../core/job/usecase/job-worker";
import type { JobStatus, JobType } from "../../core/job/type/job";

type EnqueueTradeOptions = {
  from: string;
  to: string;
  toTradeToken?: string;
  sku: string;
  amount: string;
  appId: string;
  contextId: string;
  message?: string;
  maxAttempts: string;
};

type ListJobsOptions = {
  status?: string;
  type?: string;
  limit: string;
};

type InspectJobOptions = {
  id: string;
  transitionLimit: string;
};

type RetryJobOptions = {
  id: string;
  reason?: string;
};

type FailReasonOptions = {
  id: string;
};

type CancelJobOptions = {
  id: string;
  reason?: string;
};

type WorkerOptions = {
  workerId: string;
  limit: string;
  leaseMs: string;
  once?: boolean;
  intervalSeconds: string;
};

type RegisterJobCommandDeps = {
  jobService: JobService;
  jobWorkerService: JobWorkerService;
  sleep: (ms: number) => Promise<void>;
};

const VALID_JOB_STATUS: JobStatus[] = ["PENDING", "RUNNING", "RETRY_WAIT", "COMPLETED", "FAILED", "CANCELED"];
const VALID_JOB_TYPE: JobType[] = ["TRADE_OFFER_CREATE"];

function parseOptionalJobStatus(value?: string): JobStatus | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toUpperCase() as JobStatus;
  if (!VALID_JOB_STATUS.includes(normalized)) {
    throw new Error(`Unsupported job status: ${value}`);
  }
  return normalized;
}

function parseOptionalJobType(value?: string): JobType | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toUpperCase() as JobType;
  if (!VALID_JOB_TYPE.includes(normalized)) {
    throw new Error(`Unsupported job type: ${value}`);
  }
  return normalized;
}

export function registerJobCommands(job: Command, deps: RegisterJobCommandDeps): void {
  job
    .command("enqueue-trade")
    .requiredOption("--from <from>", "Source bot name")
    .requiredOption("--to <to>", "Target bot name")
    .option("--to-trade-token <toTradeToken>", "Recipient bot trade-offer token")
    .requiredOption("--sku <sku>", "TF2-style SKU (defindex + attributes)")
    .requiredOption("--amount <amount>", "Quantity to send")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .option("--message <message>", "Optional message for trade offer")
    .option("--max-attempts <maxAttempts>", "Max attempts before FAILED", "5")
    .action(async (options: EnqueueTradeOptions) => {
      const amount = Number(options.amount);
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("--amount must be a positive integer");
      }

      const maxAttempts = Number(options.maxAttempts);
      if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
        throw new Error("--max-attempts must be a positive integer");
      }

      const created = await deps.jobService.enqueueTradeOffer({
        payload: {
          fromBotName: options.from,
          toBotName: options.to,
          ...(options.toTradeToken ? { toBotTradeToken: options.toTradeToken } : {}),
          appId: Number(options.appId),
          contextId: options.contextId,
          sku: options.sku,
          amount,
          ...(options.message ? { message: options.message } : {}),
        },
        maxAttempts,
      });

      console.table([
        {
          jobId: created.id,
          type: created.type,
          status: created.status,
          nextRunAt: created.nextRunAt.toISOString(),
          maxAttempts: created.maxAttempts,
        },
      ]);
    });

  job
    .command("list")
    .option("--status <status>", "Job status filter")
    .option("--type <type>", "Job type filter")
    .option("--limit <limit>", "Row limit", "50")
    .action(async (options: ListJobsOptions) => {
      const limit = Number(options.limit);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error("--limit must be a positive integer");
      }
      const parsedStatus = parseOptionalJobStatus(options.status);
      const parsedType = parseOptionalJobType(options.type);
      const rows = await deps.jobService.listJobs({
        ...(parsedStatus ? { status: parsedStatus } : {}),
        ...(parsedType ? { type: parsedType } : {}),
        limit,
      });
      if (rows.length === 0) {
        console.log("No jobs found.");
        return;
      }
      console.table(
        rows.map((item) => ({
          id: item.id,
          type: item.type,
          status: item.status,
          attemptCount: item.attemptCount,
          maxAttempts: item.maxAttempts,
          nextRunAt: item.nextRunAt.toISOString(),
          claimedBy: item.claimedBy,
          claimExpiresAt: item.claimExpiresAt?.toISOString() ?? null,
          lastErrorCode: item.lastErrorCode,
          createdAt: item.createdAt.toISOString(),
        }))
      );
    });

  job
    .command("inspect")
    .requiredOption("--id <id>", "Job id")
    .option("--transition-limit <transitionLimit>", "Transition row limit", "20")
    .action(async (options: InspectJobOptions) => {
      const transitionLimit = Number(options.transitionLimit);
      if (!Number.isInteger(transitionLimit) || transitionLimit <= 0) {
        throw new Error("--transition-limit must be a positive integer");
      }
      const result = await deps.jobService.inspectJob({
        jobId: options.id,
        transitionLimit,
      });
      console.table([
        {
          id: result.job.id,
          type: result.job.type,
          status: result.job.status,
          attemptCount: result.job.attemptCount,
          maxAttempts: result.job.maxAttempts,
          nextRunAt: result.job.nextRunAt.toISOString(),
          claimedBy: result.job.claimedBy,
          claimExpiresAt: result.job.claimExpiresAt?.toISOString() ?? null,
          lastErrorCode: result.job.lastErrorCode,
          lastErrorMessage: result.job.lastErrorMessage,
          completedAt: result.job.completedAt?.toISOString() ?? null,
          canceledAt: result.job.canceledAt?.toISOString() ?? null,
          createdAt: result.job.createdAt.toISOString(),
          updatedAt: result.job.updatedAt.toISOString(),
        },
      ]);

      if (result.transitions.length === 0) {
        console.log("No transitions found.");
        return;
      }
      console.table(
        result.transitions.map((item) => ({
          id: item.id,
          from: item.fromStatus,
          to: item.toStatus,
          reasonCode: item.reasonCode,
          reasonMessage: item.reasonMessage,
          actor: item.actor,
          createdAt: item.createdAt.toISOString(),
        }))
      );
    });

  job
    .command("fail-reason")
    .requiredOption("--id <id>", "Job id")
    .action(async (options: FailReasonOptions) => {
      const result = await deps.jobService.getFailReason(options.id);
      console.table([
        {
          jobId: result.jobId,
          status: result.status,
          lastErrorCode: result.lastErrorCode,
          lastErrorMessage: result.lastErrorMessage,
          attemptCount: result.attemptCount,
          maxAttempts: result.maxAttempts,
          updatedAt: result.updatedAt.toISOString(),
        },
      ]);
    });

  job
    .command("retry")
    .requiredOption("--id <id>", "Job id")
    .option("--reason <reason>", "Manual retry reason")
    .action(async (options: RetryJobOptions) => {
      const updated = await deps.jobService.retryJob({
        jobId: options.id,
        actor: "cli:job.retry",
        ...(options.reason ? { reasonMessage: options.reason } : {}),
      });
      console.table([{ id: updated.id, status: updated.status, nextRunAt: updated.nextRunAt.toISOString() }]);
    });

  job
    .command("cancel")
    .requiredOption("--id <id>", "Job id")
    .option("--reason <reason>", "Manual cancel reason")
    .action(async (options: CancelJobOptions) => {
      const updated = await deps.jobService.cancelJob({
        jobId: options.id,
        actor: "cli:job.cancel",
        ...(options.reason ? { reasonMessage: options.reason } : {}),
      });
      console.table([{ id: updated.id, status: updated.status, canceledAt: updated.canceledAt?.toISOString() ?? null }]);
    });

  job
    .command("worker")
    .option("--worker-id <workerId>", "Worker id", "worker-1")
    .option("--limit <limit>", "Max jobs per iteration", "10")
    .option("--lease-ms <leaseMs>", "Lease time in milliseconds", "30000")
    .option("--once", "Run single iteration")
    .option("--interval-seconds <intervalSeconds>", "Loop interval in seconds", "5")
    .action(async (options: WorkerOptions) => {
      const limit = Number(options.limit);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error("--limit must be a positive integer");
      }
      const leaseMs = Number(options.leaseMs);
      if (!Number.isInteger(leaseMs) || leaseMs <= 0) {
        throw new Error("--lease-ms must be a positive integer");
      }
      const intervalMs = Number(options.intervalSeconds) * 1000;
      if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
        throw new Error("--interval-seconds must be a positive integer");
      }

      if (options.once) {
        const summary = await deps.jobWorkerService.runOnce({
          workerId: options.workerId,
          limit,
          leaseMs,
        });
        console.table([summary]);
        return;
      }

      while (true) {
        const summary = await deps.jobWorkerService.runOnce({
          workerId: options.workerId,
          limit,
          leaseMs,
        });
        console.table([summary]);
        await deps.sleep(intervalMs);
      }
    });
}
