import test from "node:test";
import assert from "node:assert/strict";
import type { JobRepository, TransitionJobInput } from "../interface/job-repository";
import type { JobRecord, JobStatus, JobTransitionRecord } from "../type/job";
import { JobStateMachineService } from "./job-state-machine";

class FakeJobRepository implements JobRepository {
  public readonly jobs = new Map<string, JobRecord>();
  public readonly transitions: JobTransitionRecord[] = [];

  constructor(seedJobs: JobRecord[]) {
    for (const job of seedJobs) {
      this.jobs.set(job.id, job);
    }
  }

  createJob(): Promise<JobRecord> {
    return Promise.reject(new Error("not used"));
  }
  listJobs(): Promise<JobRecord[]> {
    return Promise.reject(new Error("not used"));
  }
  claimRunnableJobs(): Promise<JobRecord[]> {
    return Promise.reject(new Error("not used"));
  }
  listLeaseExpiredRunningJobs(): Promise<JobRecord[]> {
    return Promise.reject(new Error("not used"));
  }

  async findJobById(jobId: string): Promise<JobRecord | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async listTransitions(jobId: string): Promise<JobTransitionRecord[]> {
    return this.transitions.filter((item) => item.jobId === jobId);
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

function createJob(status: JobStatus): JobRecord {
  const now = new Date("2026-02-24T00:00:00.000Z");
  return {
    id: "job-1",
    type: "TRADE_OFFER_CREATE",
    status,
    payload: {},
    attemptCount: 0,
    maxAttempts: 5,
    nextRunAt: now,
    claimedBy: null,
    claimExpiresAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null,
    canceledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

void test("retry transitions FAILED -> PENDING", async () => {
  const repository = new FakeJobRepository([createJob("FAILED")]);
  const service = new JobStateMachineService(repository);

  const updated = await service.retry({
    jobId: "job-1",
    actor: "cli:test",
  });

  assert.equal(updated.status, "PENDING");
  assert.equal(repository.transitions[0]?.fromStatus, "FAILED");
  assert.equal(repository.transitions[0]?.toStatus, "PENDING");
});

void test("cancel rejects RUNNING job", async () => {
  const repository = new FakeJobRepository([createJob("RUNNING")]);
  const service = new JobStateMachineService(repository);

  await assert.rejects(
    service.cancel({
      jobId: "job-1",
      actor: "cli:test",
    }),
    /Transition denied/
  );
});

void test("recoverExpiredLease transitions RUNNING -> RETRY_WAIT", async () => {
  const repository = new FakeJobRepository([createJob("RUNNING")]);
  const service = new JobStateMachineService(repository);

  const now = new Date("2026-02-24T01:00:00.000Z");
  const updated = await service.recoverExpiredLease({
    jobId: "job-1",
    actor: "worker:test",
    now,
  });

  assert.equal(updated.status, "RETRY_WAIT");
  assert.equal(updated.nextRunAt.toISOString(), now.toISOString());
  assert.equal(repository.transitions[0]?.reasonCode, "lease_expired");
});
