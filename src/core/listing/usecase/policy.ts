import type { ListingPolicyRepository } from "../interface/listing-policy-repository";
import type { ListingPolicy, ListingSource } from "../type/policy";
import type { DebugLogger } from "../../shared/type/debug-logger";

const VALID_SOURCE: ListingSource[] = ["backpack.tf"];

export class ListingPolicyService {
  constructor(
    private readonly repository: ListingPolicyRepository,
    private readonly debugLogger?: DebugLogger
  ) {}

  private debug(message: string, meta?: unknown): void {
    this.debugLogger?.("ListingPolicyService", message, meta);
  }

  private parseSource(source: string): ListingSource {
    const normalized = source.trim() as ListingSource;
    if (!VALID_SOURCE.includes(normalized)) {
      throw new Error(`Unsupported listing source: ${source}`);
    }
    return normalized;
  }

  async upsertPolicy(input: {
    source: string;
    appId: number;
    contextId: string;
    sku: string;
    minMarginBps: number;
    maxExposure: number;
    targetBotName: string;
  }): Promise<ListingPolicy> {
    const source = this.parseSource(input.source);
    if (!Number.isInteger(input.appId) || input.appId <= 0) {
      throw new Error("appId must be a positive integer");
    }
    if (!input.contextId.trim()) {
      throw new Error("contextId must not be empty");
    }
    if (!input.sku.trim()) {
      throw new Error("sku must not be empty");
    }
    if (!Number.isInteger(input.minMarginBps) || input.minMarginBps < 0) {
      throw new Error("minMarginBps must be a non-negative integer");
    }
    if (!Number.isInteger(input.maxExposure) || input.maxExposure <= 0) {
      throw new Error("maxExposure must be a positive integer");
    }
    if (!input.targetBotName.trim()) {
      throw new Error("targetBotName must not be empty");
    }

    this.debug("upsertPolicy:start", input);
    const result = await this.repository.upsertPolicy({
      source,
      appId: input.appId,
      contextId: input.contextId.trim(),
      sku: input.sku.trim(),
      minMarginBps: input.minMarginBps,
      maxExposure: input.maxExposure,
      targetBotName: input.targetBotName.trim(),
    });
    this.debug("upsertPolicy:done", { policyId: result.id });
    return result;
  }

  async listPolicies(input?: { source?: string; enabled?: boolean }): Promise<ListingPolicy[]> {
    const source = input?.source ? this.parseSource(input.source) : undefined;
    return this.repository.listPolicies({
      ...(source ? { source } : {}),
      ...(input?.enabled !== undefined ? { enabled: input.enabled } : {}),
    });
  }

  async disablePolicy(input: {
    source: string;
    appId: number;
    contextId: string;
    sku: string;
    targetBotName: string;
  }): Promise<ListingPolicy> {
    const source = this.parseSource(input.source);
    if (!input.contextId.trim() || !input.sku.trim() || !input.targetBotName.trim()) {
      throw new Error("contextId, sku, targetBotName must not be empty");
    }
    return this.repository.disablePolicy({
      source,
      appId: input.appId,
      contextId: input.contextId.trim(),
      sku: input.sku.trim(),
      targetBotName: input.targetBotName.trim(),
    });
  }
}
