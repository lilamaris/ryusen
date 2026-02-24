import type { Command } from "commander";
import type { ListingPolicyService } from "../../core/listing/usecase/policy";

type ListingPolicySetOptions = {
  source: string;
  appId: string;
  contextId: string;
  sku: string;
  minMarginBps: string;
  maxExposure: string;
  targetBotName: string;
};

type ListingPolicyListOptions = {
  source?: string;
  enabled?: boolean;
  disabled?: boolean;
};

type ListingPolicyDisableOptions = {
  source: string;
  appId: string;
  contextId: string;
  sku: string;
  targetBotName: string;
};

type RegisterListingCommandDeps = {
  listingPolicyService: ListingPolicyService;
};

export function registerListingCommands(listing: Command, deps: RegisterListingCommandDeps): void {
  const policy = listing.command("policy").description("Listing policy management");

  policy
    .command("set")
    .option("--source <source>", "Listing source", "backpack.tf")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .requiredOption("--sku <sku>", "Target SKU")
    .requiredOption("--min-margin-bps <minMarginBps>", "Minimum margin in bps")
    .requiredOption("--max-exposure <maxExposure>", "Maximum listing exposure amount")
    .requiredOption("--target-bot-name <targetBotName>", "Target bot name")
    .action(async (options: ListingPolicySetOptions) => {
      const policy = await deps.listingPolicyService.upsertPolicy({
        source: options.source,
        appId: Number(options.appId),
        contextId: options.contextId,
        sku: options.sku,
        minMarginBps: Number(options.minMarginBps),
        maxExposure: Number(options.maxExposure),
        targetBotName: options.targetBotName,
      });
      console.table([
        {
          id: policy.id,
          source: policy.source,
          appId: policy.appId,
          contextId: policy.contextId,
          sku: policy.sku,
          enabled: policy.enabled,
          minMarginBps: policy.minMarginBps,
          maxExposure: policy.maxExposure,
          targetBotName: policy.targetBotName,
        },
      ]);
    });

  policy
    .command("list")
    .option("--source <source>", "Listing source filter")
    .option("--enabled", "Only enabled policies")
    .option("--disabled", "Only disabled policies")
    .action(async (options: ListingPolicyListOptions) => {
      if (options.enabled && options.disabled) {
        throw new Error("Use either --enabled or --disabled, not both.");
      }
      const rows = await deps.listingPolicyService.listPolicies({
        ...(options.source ? { source: options.source } : {}),
        ...(options.enabled ? { enabled: true } : {}),
        ...(options.disabled ? { enabled: false } : {}),
      });
      if (rows.length === 0) {
        console.log("No listing policies found.");
        return;
      }
      console.table(
        rows.map((item) => ({
          id: item.id,
          source: item.source,
          appId: item.appId,
          contextId: item.contextId,
          sku: item.sku,
          enabled: item.enabled,
          minMarginBps: item.minMarginBps,
          maxExposure: item.maxExposure,
          targetBotName: item.targetBotName,
          updatedAt: item.updatedAt.toISOString(),
        }))
      );
    });

  policy
    .command("disable")
    .option("--source <source>", "Listing source", "backpack.tf")
    .option("--app-id <appId>", "App ID", "440")
    .option("--context-id <contextId>", "Context ID", "2")
    .requiredOption("--sku <sku>", "Target SKU")
    .requiredOption("--target-bot-name <targetBotName>", "Target bot name")
    .action(async (options: ListingPolicyDisableOptions) => {
      const updated = await deps.listingPolicyService.disablePolicy({
        source: options.source,
        appId: Number(options.appId),
        contextId: options.contextId,
        sku: options.sku,
        targetBotName: options.targetBotName,
      });
      console.table([
        {
          id: updated.id,
          source: updated.source,
          appId: updated.appId,
          contextId: updated.contextId,
          sku: updated.sku,
          targetBotName: updated.targetBotName,
          enabled: updated.enabled,
        },
      ]);
    });
}
