import test from "node:test";
import assert from "node:assert/strict";
import type {
  CreateJobInput,
  JobListFilter,
  JobRepository,
  TransitionJobInput,
} from "../interface/job-repository";
import type { JobRecord, JobStatus, JobTransitionRecord } from "../type/job";
import { JobStateMachineService } from "./job-state-machine";
import { JobWorkerService } from "./job-worker";

class FakeJobRepository implements JobRepository {
  public readonly jobs = new Map<string, JobRecord>();
  public readonly transitions: JobTransitionRecord[] = [];

  constructor(seedJobs: JobRecord[]) {
    for (const job of seedJobs) {
      this.jobs.set(job.id, job);
    }
  }

  async createJob(input: CreateJobInput): Promise<JobRecord> {
    const now = new Date("2026-02-24T00:00:00.000Z");
    const job: JobRecord = {
      id: `job-${this.jobs.size + 1}`,
      type: input.type,
      status: "PENDING",
      payload: input.payload,
      attemptCount: 0,
      maxAttempts: input.maxAttempts,
      nextRunAt: input.nextRunAt,
      claimedBy: null,
      claimExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      completedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async listJobs(filter: JobListFilter): Promise<JobRecord[]> {
    let rows = [...this.jobs.values()];
    if (filter.status) {
      rows = rows.filter((item) => item.status === filter.status);
    }
    if (filter.type) {
      rows = rows.filter((item) => item.type === filter.type);
    }
    return rows.slice(0, filter.limit);
  }

  async findJobById(jobId: string): Promise<JobRecord | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async listTransitions(jobId: string, limit: number): Promise<JobTransitionRecord[]> {
    return this.transitions.filter((item) => item.jobId === jobId).slice(0, limit);
  }

  async claimRunnableJobs(input: {
    workerId: string;
    now: Date;
    limit: number;
    leaseMs: number;
  }): Promise<JobRecord[]> {
    const runnable = [...this.jobs.values()]
      .filter(
        (item) =>
          (item.status === "PENDING" || item.status === "RETRY_WAIT") &&
          item.nextRunAt.getTime() <= input.now.getTime()
      )
      .slice(0, input.limit);

    const claimed: JobRecord[] = [];
    for (const job of runnable) {
      const fromStatus = job.status;
      const updated: JobRecord = {
        ...job,
        status: "RUNNING",
        attemptCount: job.attemptCount + 1,
        claimedBy: input.workerId,
        claimExpiresAt: new Date(input.now.getTime() + input.leaseMs),
      };
      this.jobs.set(job.id, updated);
      this.transitions.push({
        id: `tr-${this.transitions.length + 1}`,
        jobId: job.id,
        fromStatus,
        toStatus: "RUNNING",
        reasonCode: "claimed",
        reasonMessage: null,
        actor: `worker:${input.workerId}`,
        createdAt: input.now,
      });
      claimed.push(updated);
    }
    return claimed;
  }

  async listLeaseExpiredRunningJobs(now: Date, limit: number): Promise<JobRecord[]> {
    return [...this.jobs.values()]
      .filter(
        (item) =>
          item.status === "RUNNING" &&
          item.claimExpiresAt !== null &&
          item.claimExpiresAt.getTime() < now.getTime()
      )
      .slice(0, limit);
  }

  async transitionJob(input: TransitionJobInput): Promise<JobRecord> {
    const current = this.jobs.get(input.jobId);
    if (!current) {
      throw new Error(`Job not found: ${input.jobId}`);
    }
    if (!input.allowedFrom.includes(current.status)) {
      throw new Error(`Transition denied: ${current.status} -> ${input.toStatus}`);
    }

    const updated: JobRecord = {
      ...current,
      status: input.toStatus,
      nextRunAt: input.patch?.nextRunAt ?? current.nextRunAt,
      claimedBy: input.patch?.claimedBy === undefined ? current.claimedBy : input.patch.claimedBy,
      claimExpiresAt:
        input.patch?.claimExpiresAt === undefined ? current.claimExpiresAt : input.patch.claimExpiresAt,
      lastErrorCode:
        input.patch?.lastErrorCode === undefined ? current.lastErrorCode : input.patch.lastErrorCode,
      lastErrorMessage:
        input.patch?.lastErrorMessage === undefined ? current.lastErrorMessage : input.patch.lastErrorMessage,
      completedAt: input.patch?.completedAt === undefined ? current.completedAt : input.patch.completedAt,
      canceledAt: input.patch?.canceledAt === undefined ? current.canceledAt : input.patch.canceledAt,
      updatedAt: new Date(current.updatedAt.getTime() + 1),
    };
    this.jobs.set(input.jobId, updated);
    this.transitions.push({
      id: `tr-${this.transitions.length + 1}`,
      jobId: input.jobId,
      fromStatus: current.status,
      toStatus: input.toStatus,
      reasonCode: input.reasonCode ?? null,
      reasonMessage: input.reasonMessage ?? null,
      actor: input.actor,
      createdAt: new Date(),
    });
    return updated;
  }
}

function createJob(input: {
  id: string;
  status: JobStatus;
  nextRunAt?: Date;
  attemptCount?: number;
  maxAttempts?: number;
  claimExpiresAt?: Date | null;
}): JobRecord {
  const now = new Date("2026-02-24T00:00:00.000Z");
  return {
    id: input.id,
    type: "TRADE_OFFER_CREATE",
    status: input.status,
    payload: {
      fromBotName: "alpha",
      toBotName: "beta",
      appId: 440,
      contextId: "2",
      sku: "5021;6",
      amount: 1,
    },
    attemptCount: input.attemptCount ?? 0,
    maxAttempts: input.maxAttempts ?? 3,
    nextRunAt: input.nextRunAt ?? now,
    claimedBy: null,
    claimExpiresAt: input.claimExpiresAt ?? null,
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null,
    canceledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

void test("runOnce completes claimed job when handler succeeds", async () => {
  const repository = new FakeJobRepository([createJob({ id: "job-1", status: "PENDING" })]);
  const stateMachine = new JobStateMachineService(repository);
  const worker = new JobWorkerService(repository, stateMachine, {
    TRADE_OFFER_CREATE: () => Promise.resolve(),
  });

  const result = await worker.runOnce({
    workerId: "w1",
    limit: 10,
    leaseMs: 30_000,
    now: new Date("2026-02-24T00:00:01.000Z"),
  });

  assert.equal(result.claimed, 1);
  assert.equal(result.completed, 1);
  assert.equal(repository.jobs.get("job-1")?.status, "COMPLETED");
});

void test("runOnce moves retryable error to RETRY_WAIT", async () => {
  const repository = new FakeJobRepository([createJob({ id: "job-1", status: "PENDING", attemptCount: 0, maxAttempts: 3 })]);
  const stateMachine = new JobStateMachineService(repository);
  const worker = new JobWorkerService(repository, stateMachine, {
    TRADE_OFFER_CREATE: () => Promise.reject(new Error("network timeout from steam")),
  });

  const result = await worker.runOnce({
    workerId: "w1",
    limit: 10,
    leaseMs: 30_000,
    now: new Date("2026-02-24T00:00:01.000Z"),
  });

  assert.equal(result.retried, 1);
  assert.equal(repository.jobs.get("job-1")?.status, "RETRY_WAIT");
});

void test("runOnce marks failed when max attempts is reached", async () => {
  const repository = new FakeJobRepository([
    createJob({ id: "job-1", status: "PENDING", attemptCount: 2, maxAttempts: 3 }),
  ]);
  const stateMachine = new JobStateMachineService(repository);
  const worker = new JobWorkerService(repository, stateMachine, {
    TRADE_OFFER_CREATE: () => Promise.reject(new Error("network timeout from steam")),
  });

  const result = await worker.runOnce({
    workerId: "w1",
    limit: 10,
    leaseMs: 30_000,
    now: new Date("2026-02-24T00:00:01.000Z"),
  });

  assert.equal(result.failed, 1);
  assert.equal(repository.jobs.get("job-1")?.status, "FAILED");
});

void test("runOnce recovers lease-expired RUNNING job before claim", async () => {
  const repository = new FakeJobRepository([
    createJob({
      id: "job-1",
      status: "RUNNING",
      claimExpiresAt: new Date("2026-02-24T00:00:00.000Z"),
    }),
  ]);
  const stateMachine = new JobStateMachineService(repository);
  const worker = new JobWorkerService(repository, stateMachine, {
    TRADE_OFFER_CREATE: () => Promise.resolve(),
  });

  const result = await worker.runOnce({
    workerId: "w1",
    limit: 10,
    leaseMs: 30_000,
    now: new Date("2026-02-24T00:00:01.000Z"),
  });

  assert.equal(result.recovered, 1);
  assert.equal(result.claimed, 1);
  assert.equal(repository.jobs.get("job-1")?.status, "COMPLETED");
});
