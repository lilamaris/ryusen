# Listing Automation Module

## Purpose

- Manage listing strategy/policy inputs before full automatic listing execution is enabled.
- Provide operator commands to create, inspect, and disable listing policies.
- Scope boundary:
  - In scope: policy CRUD-like management and validation.
  - Out of scope: price/stock decision engine and market listing execution.

## Owning Code Paths

- `src/core/listing/type/policy.ts`
  - Listing policy contracts and source identifiers.
- `src/core/listing/interface/listing-policy-repository.ts`
  - Policy persistence port.
- `src/core/listing/usecase/policy.ts`
  - Policy validation and orchestration use case.
- `src/adapter/prisma/listing/listing-policy-repository.ts`
  - Prisma policy repository implementation.
- `src/presentation/command/listing.ts`
  - `listing policy set/list/disable` CLI command wiring.
- `src/index.ts`
  - `listing` command group registration.
- `src/app/bootstrap.ts`
  - Repository/service wiring.

## Data Contracts / Persistence

- `ListingPolicy`
  - `source`, `appId`, `contextId`, `sku`, `targetBotName`
  - `enabled`, `minMarginBps`, `maxExposure`
- Persistence table:
  - `ListingPolicy` (unique by `source + appId + contextId + sku + targetBotName`)

## Main Flows

### Flow: `listing policy set`

1. CLI parses source/app/context/sku/margin/exposure/target bot.
2. `ListingPolicyService` validates values and normalizes string fields.
3. Repository upserts the policy and forces `enabled=true`.
4. CLI prints policy row.

### Flow: `listing policy list`

1. CLI parses optional filter (`source`, `enabled/disabled`).
2. Service resolves source validation and passes filters.
3. Repository returns sorted policy rows.
4. CLI renders table.

### Flow: `listing policy disable`

1. CLI receives policy identity keys.
2. Service validates keys.
3. Repository updates matching policy with `enabled=false`.
4. CLI prints updated row.

## CLI Usage

```bash
npm run dev -- listing policy set --sku <sku> --min-margin-bps 200 --max-exposure 5 --target-bot-name <bot> [--source backpack.tf] [--app-id 440] [--context-id 2]
npm run dev -- listing policy list [--source backpack.tf] [--enabled|--disabled]
npm run dev -- listing policy disable --sku <sku> --target-bot-name <bot> [--source backpack.tf] [--app-id 440] [--context-id 2]
```

## Failure / Recovery Policy

- Unsupported source:
  - Returns `Unsupported listing source`.
- Invalid numeric policy input:
  - `minMarginBps` must be non-negative integer.
  - `maxExposure` must be positive integer.
- Unknown policy on disable:
  - Prisma unique-key update error is surfaced to operator.
