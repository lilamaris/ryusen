import assert from "node:assert/strict";
import test from "node:test";
import type {
  TradeConsolidationJobRecord,
  TradeConsolidationRepository,
} from "../port/trade-consolidation-repository";
import { TradeConsolidationSettlementService } from "./trade-consolidation-settlement-service";

class FakeTradeConsolidationRepository implements TradeConsolidationRepository {
  constructor(public job: TradeConsolidationJobRecord | null) {}

  createPlannedJob(): Promise<TradeConsolidationJobRecord> {
    return Promise.reject(new Error("not used"));
  }

  listJobs(): Promise<TradeConsolidationJobRecord[]> {
    return Promise.resolve(this.job ? [this.job] : []);
  }

  findJobById(jobId: string): Promise<TradeConsolidationJobRecord | null> {
    if (!this.job || this.job.id !== jobId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.job);
  }

  updateLegStatus(input: { legId: string; status: "PLANNED" | "COMPLETED" | "FAILED" }): Promise<void> {
    if (!this.job) {
      return Promise.resolve();
    }
    this.job = {
      ...this.job,
      legs: this.job.legs.map((leg) => (leg.id === input.legId ? { ...leg, status: input.status } : leg)),
    };
    return Promise.resolve();
  }

  updateJobStatus(input: {
    jobId: string;
    status: "PLANNED" | "COMPLETED" | "FAILED";
    failureReason?: string | null;
  }): Promise<void> {
    if (!this.job || this.job.id !== input.jobId) {
      return Promise.resolve();
    }
    this.job = {
      ...this.job,
      status: input.status,
      failureReason: input.failureReason ?? null,
    };
    return Promise.resolve();
  }
}

function createPlannedJob(): TradeConsolidationJobRecord {
  const now = new Date("2026-02-22T00:00:00.000Z");
  return {
    id: "job-1",
    controlBotId: "control",
    appId: 440,
    contextId: "2",
    sku: "5500",
    requestedAmount: 3,
    status: "PLANNED",
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    legs: [
      {
        id: "leg-1",
        fromBotId: "a",
        toBotId: "control",
        sku: "5500",
        amount: 1,
        status: "PLANNED",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "leg-2",
        fromBotId: "b",
        toBotId: "control",
        sku: "5500",
        amount: 2,
        status: "PLANNED",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

void test("markLegCompleted completes job when last planned leg is completed", async () => {
  const repository = new FakeTradeConsolidationRepository(createPlannedJob());
  const service = new TradeConsolidationSettlementService(repository);

  await service.markLegCompleted({ jobId: "job-1", legId: "leg-1" });
  assert.equal(repository.job?.status, "PLANNED");

  await service.markLegCompleted({ jobId: "job-1", legId: "leg-2" });
  assert.equal(repository.job?.status, "COMPLETED");
});

void test("markLegFailed marks both leg and job as failed", async () => {
  const repository = new FakeTradeConsolidationRepository(createPlannedJob());
  const service = new TradeConsolidationSettlementService(repository);

  await service.markLegFailed({
    jobId: "job-1",
    legId: "leg-1",
    reason: "manual trade rejected",
  });

  assert.equal(repository.job?.status, "FAILED");
  assert.equal(repository.job?.failureReason, "manual trade rejected");
  assert.equal(repository.job?.legs[0]?.status, "FAILED");
});
