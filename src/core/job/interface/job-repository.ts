import type { JobRecord, JobStatus, JobTransitionRecord, JobType } from "../type/job";

export type JobListFilter = {
  type?: JobType;
  status?: JobStatus;
  limit: number;
};

export type CreateJobInput = {
  type: JobType;
  payload: unknown;
  maxAttempts: number;
  nextRunAt: Date;
};

export type TransitionJobInput = {
  jobId: string;
  allowedFrom: JobStatus[];
  toStatus: JobStatus;
  actor: string;
  reasonCode?: string;
  reasonMessage?: string;
  patch?: {
    nextRunAt?: Date;
    claimedBy?: string | null;
    claimExpiresAt?: Date | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    completedAt?: Date | null;
    canceledAt?: Date | null;
  };
};

export interface JobRepository {
  createJob(input: CreateJobInput): Promise<JobRecord>;
  listJobs(filter: JobListFilter): Promise<JobRecord[]>;
  findJobById(jobId: string): Promise<JobRecord | null>;
  listTransitions(jobId: string, limit: number): Promise<JobTransitionRecord[]>;
  claimRunnableJobs(input: {
    workerId: string;
    now: Date;
    limit: number;
    leaseMs: number;
  }): Promise<JobRecord[]>;
  listLeaseExpiredRunningJobs(now: Date, limit: number): Promise<JobRecord[]>;
  transitionJob(input: TransitionJobInput): Promise<JobRecord>;
}
