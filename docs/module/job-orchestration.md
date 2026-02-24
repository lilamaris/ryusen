# Job Orchestration Module

## Purpose

- Define and run asynchronous job execution for trade/listing automation.
- Provide observable job state transitions and operator control commands.
- Scope boundary:
  - In scope: Job model, state machine, worker claim/execute loop, transition monitoring, retry/cancel controls.
  - Out of scope: listing strategy rules, incoming-trade business policy details.

## Owning Code Paths

- Core paths:
  - `src/core/job/type/job.ts`
  - `src/core/job/interface/job-repository.ts`
  - `src/core/job/usecase/job.ts`
  - `src/core/job/usecase/job-state-machine.ts`
  - `src/core/job/usecase/job-worker.ts`
- Adapter paths:
  - `src/adapter/prisma/job/job-repository.ts`
- Presentation paths:
  - `src/presentation/command/job.ts`
  - `src/index.ts` (`job` command wiring)
- Integration paths:
  - `src/core/trade/usecase/trade.ts` (first executable handler candidate)
  - `src/app/bootstrap.ts` (dependency wiring)

## Data Contracts / Persistence

- Primary models:
  - `Job`: type, status, payload, attempts, nextRunAt, claim lease, lastError, timestamps.
  - `JobTransition`: append-only transition history (`fromStatus`, `toStatus`, reason, actor, createdAt).
- Initial job types:
  - `TRADE_OFFER_CREATE` (first)
  - `LISTING_UPSERT` (later)

## Main Flows

### Flow: Worker run loop

1. Worker claims runnable jobs (`pending` or due `retry_wait`) with lease.
2. Worker marks job `running` through state machine transition.
3. Handler executes payload.
4. State machine records one of:
  - `running -> completed`
  - `running -> retry_wait`
  - `running -> failed`
5. Transition log is queryable by CLI.

### Flow: Operator monitoring/control

1. `job list` shows current job states.
2. `job inspect` shows one job + transition history.
3. `job fail-reason` shows latest failure code/message and attempt counters.
4. `job retry` requeues failed job (`failed -> pending`).
5. `job cancel` cancels pending/retry job.

## CLI Usage (Planned)

```bash
npm run dev -- job enqueue-trade --from <bot> --to <bot> --sku <sku> --amount <n>
npm run dev -- job list [--status PENDING] [--type TRADE_OFFER_CREATE] [--limit 50]
npm run dev -- job inspect --id <job-id>
npm run dev -- job fail-reason --id <job-id>
npm run dev -- job retry --id <job-id>
npm run dev -- job cancel --id <job-id>
npm run dev -- job worker [--once] [--limit 10]
```

## Failure / Recovery Policy

- Retryable failures:
  - temporary network/steam/rate-limit/session issues.
- Fatal failures:
  - invalid payload, missing bot/sku, disallowed transition.
- Lease timeout recovery:
  - stale `running` jobs are moved back to retry path with reason code.

## Troubleshooting

- Job stuck in `running`
  - Check lease expiration and worker heartbeat; force recovery policy if lease expired.
- Frequent `retry_wait`
  - Inspect reason codes and tune backoff/max-attempt policy.
- Missing transition history
  - Verify state changes only happen via state machine usecase.
