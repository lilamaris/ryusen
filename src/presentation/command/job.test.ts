import test from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { registerJobCommands } from "./job";
import type { JobRecord } from "../../core/job/type/job";

class FakeJobService {
  public enqueueInput:
    | {
        payload: {
          fromBotName: string;
          toBotName: string;
          toBotTradeToken?: string;
          appId: number;
          contextId: string;
          sku: string;
          amount: number;
          message?: string;
        };
        maxAttempts?: number;
      }
    | null = null;

  public retryInput: { jobId: string; actor: string; reasonMessage?: string } | null = null;
  public failReasonInput: string | null = null;

  async enqueueTradeOffer(input: {
    payload: {
      fromBotName: string;
      toBotName: string;
      toBotTradeToken?: string;
      appId: number;
      contextId: string;
      sku: string;
      amount: number;
      message?: string;
    };
    maxAttempts?: number;
  }): Promise<JobRecord> {
    this.enqueueInput = input;
    const now = new Date("2026-02-24T00:00:00.000Z");
    return {
      id: "job-1",
      type: "TRADE_OFFER_CREATE",
      status: "PENDING",
      payload: input.payload,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 5,
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

  listJobs(): Promise<JobRecord[]> {
    return Promise.resolve([]);
  }

  inspectJob(): Promise<{ job: JobRecord; transitions: unknown[] }> {
    return Promise.reject(new Error("not used"));
  }

  async retryJob(input: { jobId: string; actor: string; reasonMessage?: string }): Promise<JobRecord> {
    this.retryInput = input;
    const now = new Date("2026-02-24T00:00:00.000Z");
    return {
      id: input.jobId,
      type: "TRADE_OFFER_CREATE",
      status: "PENDING",
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

  cancelJob(): Promise<JobRecord> {
    return Promise.reject(new Error("not used"));
  }

  async getFailReason(jobId: string): Promise<{
    jobId: string;
    status: "FAILED";
    lastErrorCode: string;
    lastErrorMessage: string;
    attemptCount: number;
    maxAttempts: number;
    updatedAt: Date;
  }> {
    this.failReasonInput = jobId;
    return {
      jobId,
      status: "FAILED",
      lastErrorCode: "fatal_error",
      lastErrorMessage: "bad input",
      attemptCount: 3,
      maxAttempts: 5,
      updatedAt: new Date("2026-02-24T00:00:00.000Z"),
    };
  }
}

class FakeJobWorkerService {
  runOnce(): Promise<{ recovered: number; claimed: number; completed: number; retried: number; failed: number }> {
    return Promise.resolve({
      recovered: 0,
      claimed: 0,
      completed: 0,
      retried: 0,
      failed: 0,
    });
  }
}

function createProgram(deps: {
  jobService: FakeJobService;
  jobWorkerService: FakeJobWorkerService;
}): Command {
  const program = new Command();
  program.exitOverride();
  const job = program.command("job");
  registerJobCommands(job, {
    jobService: deps.jobService as never,
    jobWorkerService: deps.jobWorkerService as never,
    sleep: () => Promise.resolve(),
  });
  return program;
}

void test("enqueue-trade parses numeric options and forwards to service", async () => {
  const jobService = new FakeJobService();
  const program = createProgram({
    jobService,
    jobWorkerService: new FakeJobWorkerService(),
  });

  await program.parseAsync([
    "node",
    "test",
    "job",
    "enqueue-trade",
    "--from",
    "alpha",
    "--to",
    "beta",
    "--sku",
    "5021;6",
    "--amount",
    "2",
    "--app-id",
    "440",
    "--context-id",
    "2",
    "--max-attempts",
    "7",
  ]);

  assert.equal(jobService.enqueueInput?.payload.fromBotName, "alpha");
  assert.equal(jobService.enqueueInput?.payload.amount, 2);
  assert.equal(jobService.enqueueInput?.payload.appId, 440);
  assert.equal(jobService.enqueueInput?.maxAttempts, 7);
});

void test("list rejects invalid limit", async () => {
  const jobService = new FakeJobService();
  const program = createProgram({
    jobService,
    jobWorkerService: new FakeJobWorkerService(),
  });

  await assert.rejects(
    program.parseAsync(["node", "test", "job", "list", "--limit", "0"]),
    /--limit must be a positive integer/
  );
});

void test("fail-reason forwards job id", async () => {
  const jobService = new FakeJobService();
  const program = createProgram({
    jobService,
    jobWorkerService: new FakeJobWorkerService(),
  });

  await program.parseAsync(["node", "test", "job", "fail-reason", "--id", "job-77"]);

  assert.equal(jobService.failReasonInput, "job-77");
});

void test("retry forwards optional reason", async () => {
  const jobService = new FakeJobService();
  const program = createProgram({
    jobService,
    jobWorkerService: new FakeJobWorkerService(),
  });

  await program.parseAsync([
    "node",
    "test",
    "job",
    "retry",
    "--id",
    "job-9",
    "--reason",
    "operator retry",
  ]);

  assert.equal(jobService.retryInput?.jobId, "job-9");
  assert.equal(jobService.retryInput?.reasonMessage, "operator retry");
});
