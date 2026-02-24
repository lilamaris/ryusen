import type { ListingPolicy as PrismaListingPolicy, PrismaClient } from "@prisma/client";
import { debugLog } from "../../../debug";
import type { ListingPolicyRepository } from "../../../core/listing/interface/listing-policy-repository";
import type { ListingPolicy, ListingSource, UpsertListingPolicyInput } from "../../../core/listing/type/policy";

function toPolicy(record: PrismaListingPolicy): ListingPolicy {
  return {
    id: record.id,
    source: record.source as ListingSource,
    appId: record.appId,
    contextId: record.contextId,
    sku: record.sku,
    enabled: record.enabled,
    minMarginBps: record.minMarginBps,
    maxExposure: record.maxExposure,
    targetBotName: record.targetBotName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaListingPolicyRepository implements ListingPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertPolicy(input: UpsertListingPolicyInput): Promise<ListingPolicy> {
    debugLog("PrismaListingPolicyRepository", "upsertPolicy:start", input);
    const record = await this.prisma.listingPolicy.upsert({
      where: {
        source_appId_contextId_sku_targetBotName: {
          source: input.source,
          appId: input.appId,
          contextId: input.contextId,
          sku: input.sku,
          targetBotName: input.targetBotName,
        },
      },
      update: {
        enabled: true,
        minMarginBps: input.minMarginBps,
        maxExposure: input.maxExposure,
      },
      create: {
        source: input.source,
        appId: input.appId,
        contextId: input.contextId,
        sku: input.sku,
        enabled: true,
        minMarginBps: input.minMarginBps,
        maxExposure: input.maxExposure,
        targetBotName: input.targetBotName,
      },
    });
    debugLog("PrismaListingPolicyRepository", "upsertPolicy:done", { policyId: record.id });
    return toPolicy(record);
  }

  async listPolicies(filter?: { source?: ListingSource; enabled?: boolean }): Promise<ListingPolicy[]> {
    const records = await this.prisma.listingPolicy.findMany({
      where: {
        ...(filter?.source ? { source: filter.source } : {}),
        ...(filter?.enabled !== undefined ? { enabled: filter.enabled } : {}),
      },
      orderBy: [{ source: "asc" }, { appId: "asc" }, { contextId: "asc" }, { sku: "asc" }],
    });
    return records.map(toPolicy);
  }

  async disablePolicy(input: {
    source: ListingSource;
    appId: number;
    contextId: string;
    sku: string;
    targetBotName: string;
  }): Promise<ListingPolicy> {
    const record = await this.prisma.listingPolicy.update({
      where: {
        source_appId_contextId_sku_targetBotName: {
          source: input.source,
          appId: input.appId,
          contextId: input.contextId,
          sku: input.sku,
          targetBotName: input.targetBotName,
        },
      },
      data: {
        enabled: false,
      },
    });
    return toPolicy(record);
  }
}
