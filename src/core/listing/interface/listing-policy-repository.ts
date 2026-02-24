import type { ListingPolicy, ListingSource, UpsertListingPolicyInput } from "../type/policy";

export interface ListingPolicyRepository {
  upsertPolicy(input: UpsertListingPolicyInput): Promise<ListingPolicy>;
  listPolicies(filter?: { source?: ListingSource; enabled?: boolean }): Promise<ListingPolicy[]>;
  disablePolicy(input: {
    source: ListingSource;
    appId: number;
    contextId: string;
    sku: string;
    targetBotName: string;
  }): Promise<ListingPolicy>;
}
