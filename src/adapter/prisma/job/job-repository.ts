import type {
  Job as PrismaJob,
  JobStatus as PrismaJobStatus,
  JobTransition as PrismaJobTransition,
  JobType as PrismaJobType,
  PrismaClient,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { debugLog } from "../../../debug";
import type {
  CreateJobInput,
  JobListFilter,
  JobRepository,
  TransitionJobInput,
} from "../../../core/job/interface/job-repository";
import type { JobRecord, JobStatus, JobTransitionRecord, JobType } from "../../../core/job/type/job";

function toCoreJobStatus(status: PrismaJobStatus): JobStatus {
  return status;
}

function toCoreJobType(type: PrismaJobType): JobType {
  return type;
}

function toPrismaJobStatus(status: JobStatus): PrismaJobStatus {
  return status;
}

function toPrismaJobType(type: JobType): PrismaJobType {
  return type;
}

function toJob(record: PrismaJob): JobRecord {
  return {
    id: record.id,
    type: toCoreJobType(record.type),
    status: toCoreJobStatus(record.status),
    payload: record.payload,
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    nextRunAt: record.nextRunAt,
    claimedBy: record.claimedBy,
    claimExpiresAt: record.claimExpiresAt,
    lastErrorCode: record.lastErrorCode,
    lastErrorMessage: record.lastErrorMessage,
    completedAt: record.completedAt,
    canceledAt: record.canceledAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toTransition(record: PrismaJobTransition): JobTransitionRecord {
  return {
    id: record.id,
    jobId: record.jobId,
    fromStatus: toCoreJobStatus(record.fromStatus),
    toStatus: toCoreJobStatus(record.toStatus),
    reasonCode: record.reasonCode,
    reasonMessage: record.reasonMessage,
    actor: record.actor,
    createdAt: record.createdAt,
  };
}

export class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createJob(input: CreateJobInput): Promise<JobRecord> {
    debugLog("PrismaJobRepository", "createJob:start", {
      type: input.type,
      maxAttempts: input.maxAttempts,
      nextRunAt: input.nextRunAt.toISOString(),
    });
    const record = await this.prisma.job.create({
      data: {
        type: toPrismaJobType(input.type),
        payload: input.payload as Prisma.InputJsonValue,
        maxAttempts: input.maxAttempts,
        nextRunAt: input.nextRunAt,
      },
    });
    debugLog("PrismaJobRepository", "createJob:done", { jobId: record.id });
    return toJob(record);
  }

  async listJobs(filter: JobListFilter): Promise<JobRecord[]> {
    const records = await this.prisma.job.findMany({
      where: {
        ...(filter.type ? { type: toPrismaJobType(filter.type) } : {}),
        ...(filter.status ? { status: toPrismaJobStatus(filter.status) } : {}),
      },
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
      take: filter.limit,
    });
    return records.map(toJob);
  }

  async findJobById(jobId: string): Promise<JobRecord | null> {
    const record = await this.prisma.job.findUnique({
      where: { id: jobId },
    });
    return record ? toJob(record) : null;
  }

  async listTransitions(jobId: string, limit: number): Promise<JobTransitionRecord[]> {
    const records = await this.prisma.jobTransition.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return records.map(toTransition);
  }

  async claimRunnableJobs(input: {
    workerId: string;
    now: Date;
    limit: number;
    leaseMs: number;
  }): Promise<JobRecord[]> {
    const candidates = await this.prisma.job.findMany({
      where: {
        status: { in: ["PENDING", "RETRY_WAIT"] },
        nextRunAt: { lte: input.now },
      },
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
      take: input.limit,
    });

    const claimed: JobRecord[] = [];
    for (const candidate of candidates) {
      const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
      const updated = await this.prisma.$transaction(async (tx) => {
        const updateResult = await tx.job.updateMany({
          where: {
            id: candidate.id,
            status: candidate.status,
          },
          data: {
            status: "RUNNING",
            attemptCount: { increment: 1 },
            claimedBy: input.workerId,
            claimExpiresAt: leaseExpiresAt,
          },
        });

        if (updateResult.count === 0) {
          return null;
        }

        await tx.jobTransition.create({
          data: {
            jobId: candidate.id,
            fromStatus: candidate.status,
            toStatus: "RUNNING",
            reasonCode: "claimed",
            actor: `worker:${input.workerId}`,
          },
        });

        return tx.job.findUnique({
          where: { id: candidate.id },
        });
      });

      if (updated) {
        claimed.push(toJob(updated));
      }
    }
    return claimed;
  }

  async listLeaseExpiredRunningJobs(now: Date, limit: number): Promise<JobRecord[]> {
    const records = await this.prisma.job.findMany({
      where: {
        status: "RUNNING",
        claimExpiresAt: {
          lt: now,
        },
      },
      orderBy: [{ claimExpiresAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
    return records.map(toJob);
  }

  async transitionJob(input: TransitionJobInput): Promise<JobRecord> {
    const toStatus = toPrismaJobStatus(input.toStatus);
    const allowedFrom = input.allowedFrom.map((status) => toPrismaJobStatus(status));
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.job.findUnique({
        where: { id: input.jobId },
      });
      if (!current) {
        throw new Error(`Job not found: ${input.jobId}`);
      }

      if (!allowedFrom.includes(current.status)) {
        throw new Error(`Transition denied: ${current.status} -> ${toStatus}`);
      }

      const next = await tx.job.update({
        where: { id: input.jobId },
        data: {
          status: toStatus,
          ...(input.patch?.nextRunAt ? { nextRunAt: input.patch.nextRunAt } : {}),
          ...(input.patch?.claimedBy !== undefined ? { claimedBy: input.patch.claimedBy } : {}),
          ...(input.patch?.claimExpiresAt !== undefined
            ? { claimExpiresAt: input.patch.claimExpiresAt }
            : {}),
          ...(input.patch?.lastErrorCode !== undefined ? { lastErrorCode: input.patch.lastErrorCode } : {}),
          ...(input.patch?.lastErrorMessage !== undefined
            ? { lastErrorMessage: input.patch.lastErrorMessage }
            : {}),
          ...(input.patch?.completedAt !== undefined ? { completedAt: input.patch.completedAt } : {}),
          ...(input.patch?.canceledAt !== undefined ? { canceledAt: input.patch.canceledAt } : {}),
        },
      });

      await tx.jobTransition.create({
        data: {
          jobId: input.jobId,
          fromStatus: current.status,
          toStatus,
          reasonCode: input.reasonCode ?? null,
          reasonMessage: input.reasonMessage ?? null,
          actor: input.actor,
        },
      });

      return next;
    });

    return toJob(updated);
  }
}
