import test from "node:test";
import assert from "node:assert/strict";
import type { ListingPolicyRepository } from "../interface/listing-policy-repository";
import type { ListingPolicy, UpsertListingPolicyInput } from "../type/policy";
import { ListingPolicyService } from "./policy";

class FakeListingPolicyRepository implements ListingPolicyRepository {
  public upsertInput: UpsertListingPolicyInput | null = null;
  public listInput: { source?: "backpack.tf"; enabled?: boolean } | undefined;
  public disableInput:
    | {
        source: "backpack.tf";
        appId: number;
        contextId: string;
        sku: string;
        targetBotName: string;
      }
    | null = null;

  private createPolicy(overrides?: Partial<ListingPolicy>): ListingPolicy {
    const now = new Date("2026-02-24T00:00:00.000Z");
    return {
      id: "policy-1",
      source: "backpack.tf",
      appId: 440,
      contextId: "2",
      sku: "5021;6",
      enabled: true,
      minMarginBps: 200,
      maxExposure: 5,
      targetBotName: "alpha",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  async upsertPolicy(input: UpsertListingPolicyInput): Promise<ListingPolicy> {
    this.upsertInput = input;
    return this.createPolicy({
      source: input.source,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      minMarginBps: input.minMarginBps,
      maxExposure: input.maxExposure,
      targetBotName: input.targetBotName,
    });
  }

  async listPolicies(filter?: {
    source?: "backpack.tf";
    enabled?: boolean;
  }): Promise<ListingPolicy[]> {
    this.listInput = filter;
    return [this.createPolicy()];
  }

  async disablePolicy(input: {
    source: "backpack.tf";
    appId: number;
    contextId: string;
    sku: string;
    targetBotName: string;
  }): Promise<ListingPolicy> {
    this.disableInput = input;
    return this.createPolicy({
      enabled: false,
      source: input.source,
      appId: input.appId,
      contextId: input.contextId,
      sku: input.sku,
      targetBotName: input.targetBotName,
    });
  }
}

void test("upsertPolicy validates and normalizes input", async () => {
  const repository = new FakeListingPolicyRepository();
  const service = new ListingPolicyService(repository);

  const policy = await service.upsertPolicy({
    source: "backpack.tf",
    appId: 440,
    contextId: " 2 ",
    sku: " 5021;6 ",
    minMarginBps: 150,
    maxExposure: 3,
    targetBotName: " alpha ",
  });

  assert.equal(policy.source, "backpack.tf");
  assert.equal(repository.upsertInput?.contextId, "2");
  assert.equal(repository.upsertInput?.sku, "5021;6");
  assert.equal(repository.upsertInput?.targetBotName, "alpha");
});

void test("upsertPolicy rejects unsupported source", async () => {
  const repository = new FakeListingPolicyRepository();
  const service = new ListingPolicyService(repository);

  await assert.rejects(
    service.upsertPolicy({
      source: "unknown-source",
      appId: 440,
      contextId: "2",
      sku: "5021;6",
      minMarginBps: 150,
      maxExposure: 3,
      targetBotName: "alpha",
    }),
    /Unsupported listing source/
  );
});

void test("listPolicies passes optional filters", async () => {
  const repository = new FakeListingPolicyRepository();
  const service = new ListingPolicyService(repository);

  await service.listPolicies({
    source: "backpack.tf",
    enabled: true,
  });

  assert.equal(repository.listInput?.source, "backpack.tf");
  assert.equal(repository.listInput?.enabled, true);
});

void test("disablePolicy forwards identity key", async () => {
  const repository = new FakeListingPolicyRepository();
  const service = new ListingPolicyService(repository);

  const result = await service.disablePolicy({
    source: "backpack.tf",
    appId: 440,
    contextId: "2",
    sku: "5021;6",
    targetBotName: "alpha",
  });

  assert.equal(repository.disableInput?.targetBotName, "alpha");
  assert.equal(result.enabled, false);
});
