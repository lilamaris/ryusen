# Pricing Module

## Purpose

- Query current market trading prices for a SKU from external marketplaces.
- Scope boundary:
  - In scope: source-specific price adapter call with bot access token, best buy/sell normalization, Item-based cache read/write, CLI lookup.
  - Out of scope: listing automation or signal generation.

## Owning Code Paths

- `src/core/pricing/interface/pricer.ts`
  - `Pricer` contract for source implementations.
- `src/core/pricing/type/price.ts`
  - Normalized market quote types (`bestBuy`, `bestSell`, listing counts).
- `src/core/pricing/usecase/price.ts`
  - `MarketPriceService` source routing + cache freshness orchestration.
- `src/core/pricing/interface/price-cache-repository.ts`
  - Cache repository contract used by pricing use case.
- `src/adapter/backpack/pricing/backpack-pricer.ts`
  - `backpack.tf` listings snapshot implementation.
- `src/adapter/prisma/pricing/price-cache-repository.ts`
  - Prisma cache adapter that stores price snapshot on `Item`.
- `src/presentation/command/ls.ts`
  - `ls price` CLI command wiring/output.
- `src/core/session/usecase/session.ts`
  - Resolves per-bot backpack access token for pricing call.
- `src/app/bootstrap.ts`
  - Wires source pricer implementations into `MarketPriceService`.

## Data Contracts / Persistence

- Core input:
  - `source`, `appId`, `contextId`, `sku`, `accessToken`
- Core output:
  - `MarketPriceQuote` with `bestBuy`, `bestSell`, `fetchedAt`
- Persistence:
  - `Item.priceSource`, `Item.priceBestBuy`, `Item.priceBestSell`, `Item.priceCachedAt`
  - Cache key: `appId + contextId + sku + source`
  - Default freshness policy: cached value used when `priceCachedAt` is within 120 seconds.

## Main Flows

### Flow: `ls price`

1. CLI parses `--sku`, optional `--source`, `--app-id`, `--context-id`.
2. `BotSessionService.getBackpackAccessToken` resolves token by bot name.
3. `MarketPriceService.getPrice` resolves source pricer by `source`.
4. `MarketPriceService` checks cached `Item` price snapshot by SKU/source.
5. If cache is fresh (`now - cachedAt <= maxAgeSeconds`), cached quote is returned.
6. Otherwise `BackpackTfPricer` calls backpack API with `Authorization: Token <accessToken>`, then quote is persisted to cache and returned.
7. CLI prints one summary row with source, best prices, listing counts, and fetched time.

## CLI Usage

### Query market price

```bash
npm run dev -- ls price --name <bot-name> --sku <sku> [--source backpack.tf] [--app-id 440] [--context-id 2] [--max-age-seconds 120]
```

- `--name`: 토큰을 사용할 bot 이름.
- `--sku`: source market SKU identifier.
- `--source`: market source key (`backpack.tf` currently).
- `--max-age-seconds`: cache freshness threshold in seconds (default `120`).
- Defaults: `app-id` 440, `context-id` 2.
- Output: single row containing `bestBuy`, `bestSell`, listing counts, and `fetchedAt`.

## Failure / Recovery Policy

- Validation failure:
  - Unknown source key returns `Unsupported price source`.
  - Missing token mapping returns `Backpack access token not configured for bot`.
- External dependency failure:
  - Non-2xx response from source returns source-specific HTTP error.
- Recovery:
  - Retry after confirming source availability and SKU format expected by the selected source.
  - Set `--max-age-seconds 0` to force fresh fetch without cache reuse.

## Troubleshooting

- `Unsupported price source: <source>`
  - Source key has no registered pricer implementation; use `backpack.tf`.
- `backpack.tf price request failed: ...`
  - Remote API unavailable/rate-limited; retry later.
- Empty `bestBuy`/`bestSell`
  - No matching listings returned for SKU in current source snapshot.
