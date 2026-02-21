# Trade Consolidation Module

## Purpose

- Build all-or-nothing consolidation plans that collect SKU quantity into one control bot.
- Persist job/leg states and support manual settlement updates.
- Scope boundary:
  - In scope: planning, stock precheck, leg status updates, job status transitions.
  - Out of scope: automatic Steam trade offer creation/confirmation.

## Owning Code Paths

- `src/core/port/trade-consolidation-repository.ts`
  - Consolidation job/leg persistence port.
- `src/core/usecase/control-bot-consolidation-service.ts`
  - Plan generation (`trade consolidate`).
- `src/core/usecase/trade-consolidation-settlement-service.ts`
  - Manual settlement (`leg-complete`, `leg-fail`).
- `src/core/usecase/cluster-stock-service.ts`
  - SKU stock aggregation used by planner.
- `src/adapter/persistence/prisma/prisma-trade-consolidation-repository.ts`
  - Prisma implementation for job/leg create/read/update.
- `src/adapter/persistence/prisma/prisma-bot-inventory-repository.ts`
  - Donor availability source (`listBotSkuHoldings`).
- `src/presentation/command/trade.ts`
  - Trade commands wiring.
- `src/presentation/command/ls.ts`
  - `ls stock` support path.
- `src/app/bootstrap.ts`
  - Wires consolidation planner/settlement services.

## Data Contracts / Persistence

- Core contracts:
  - `TradeConsolidationRepository.createPlannedJob`
  - `TradeConsolidationRepository.listJobs`
  - `TradeConsolidationRepository.findJobById`
  - `TradeConsolidationRepository.updateLegStatus`
  - `TradeConsolidationRepository.updateJobStatus`
- Persistence models:
  - `TradeConsolidationJob`
    - `controlBotId`, `appId`, `contextId`, `sku`, `requestedAmount`, `status`, `failureReason`
  - `TradeConsolidationLeg`
    - `jobId`, `fromBotId`, `toBotId`, `sku`, `amount`, `status`
- Status enums:
  - Job: `PLANNED` | `COMPLETED` | `FAILED`
  - Leg: `PLANNED` | `COMPLETED` | `FAILED`

## Main Flows

### Flow: `trade consolidate`

1. Resolve control bot by name.
2. Load cluster stock for SKU (`appId/contextId`).
3. Validate all-or-nothing precondition (`totalAmount >= requiredAmount`).
4. Compute `needFromOthers = requiredAmount - controlCurrentAmount`.
5. Allocate donor legs (largest donor first) until needed amount is filled.
6. Persist job and legs in `PLANNED` state.

### Flow: `trade jobs`

1. Load recent jobs with legs.
2. Resolve control bot names for display.
3. Print summary rows (`status`, `failureReason`, `legCount`).

### Flow: `trade leg-complete`

1. Load job by ID and validate `job.status === PLANNED`.
2. Validate target leg exists and is `PLANNED`.
3. Mark leg `COMPLETED`.
4. If no planned legs remain, mark job `COMPLETED`.

### Flow: `trade leg-fail`

1. Load job by ID and validate `job.status === PLANNED`.
2. Validate target leg exists and is `PLANNED`.
3. Mark leg `FAILED`.
4. Mark job `FAILED` with `failureReason`.

## CLI Usage

### Build consolidation plan

```bash
npm run dev -- trade consolidate --control-name <control-bot> --sku <sku> --amount <n> --app-id 440 --context-id 2
```

### List jobs

```bash
npm run dev -- trade jobs --limit 20
```

### Mark one leg completed

```bash
npm run dev -- trade leg-complete --job-id <job-id> --leg-id <leg-id>
```

### Mark one leg failed

```bash
npm run dev -- trade leg-fail --job-id <job-id> --leg-id <leg-id> --reason "manual trade rejected"
```

## Failure / Recovery Policy

- Planner validation:
  - Fails when control bot is missing.
  - Fails when required amount is not a positive integer.
  - Fails when cluster stock is insufficient.
- Settlement validation:
  - Only `PLANNED` jobs and legs are mutable.
  - Invalid job/leg IDs fail fast.
- Current manual policy:
  - Settlement is manual operator action.
  - Automatic compensation/rollback execution is not implemented yet.

## Troubleshooting

- `Control bot not found`
  - Register/auth the control bot first.
- `Insufficient cluster stock ...`
  - Check `ls stock` and reduce requested amount or refresh inventory.
- `Only PLANNED jobs can be updated`
  - Job already completed/failed; create a new job if needed.
- `Trade consolidation leg not found in job`
  - `leg-id` does not belong to the provided `job-id`.
