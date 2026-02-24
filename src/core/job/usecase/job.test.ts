import test from "node:test";
import assert from "node:assert/strict";
import type { CreateJobInput, JobListFilter, JobRepository, TransitionJobInput } from "../interface/job-repository";
import type { JobRecord, JobTransitionRecord } from "../type/job";
import { JobService } from "./job";
import { JobStateMachineService } from "./job-state-machine";

class FakeJobRepository implements JobRepository {
  constructor(private readonly jobs: Map<string, JobRecord>) {}

  createJob(_input: CreateJobInput): Promise<JobRecord> {
    return Promise.reject(new Error("not used"));
  }
  listJobs(_filter: JobListFilter): Promise<JobRecord[]> {
    return Promise.reject(new Error("not used"));
  }
  claimRunnableJobs(): Promise<JobRecord[]> {
    return Promise.reject(new Error("not used"));
  }
  listLeaseExpiredRunningJobs(): Promise<JobRecord[]> {
    return Promise.reject(new Error("not used"));
  }
  transitionJob(_input: TransitionJobInput): Promise<JobRecord> {
    return Promise.reject(new Error("not used"));
  }
  listTransitions(_jobId: string, _limit: number): Promise<JobTransitionRecord[]> {
    return Promise.resolve([]);
  }

  async findJobById(jobId: string): Promise<JobRecord | null> {
    return this.jobs.get(jobId) ?? null;
  }
}

function createJob(): JobRecord {
  const now = new Date("2026-02-24T00:00:00.000Z");
  return {
    id: "job-1",
    type: "TRADE_OFFER_CREATE",
    status: "FAILED",
    payload: {},
    attemptCount: 3,
    maxAttempts: 5,
    nextRunAt: now,
    claimedBy: null,
    claimExpiresAt: null,
    lastErrorCode: "fatal_error",
    lastErrorMessage: "Invalid payload",
    completedAt: null,
    canceledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

void test("getFailReason returns latest failure fields", async () => {
  const repository = new FakeJobRepository(new Map([["job-1", createJob()]]));
  const stateMachine = new JobStateMachineService(repository);
  const service = new JobService(repository, stateMachine);

  const reason = await service.getFailReason("job-1");

  assert.equal(reason.jobId, "job-1");
  assert.equal(reason.status, "FAILED");
  assert.equal(reason.lastErrorCode, "fatal_error");
  assert.equal(reason.lastErrorMessage, "Invalid payload");
  assert.equal(reason.attemptCount, 3);
  assert.equal(reason.maxAttempts, 5);
});

void test("getFailReason throws when job does not exist", async () => {
  const repository = new FakeJobRepository(new Map());
  const stateMachine = new JobStateMachineService(repository);
  const service = new JobService(repository, stateMachine);

  await assert.rejects(service.getFailReason("missing-job"), /Job not found/);
});
