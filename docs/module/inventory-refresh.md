# Inventory Refresh Module

## Purpose

- Fetch each managed bot inventory (authenticated path) and persist the latest holdings snapshot.
- Provide SKU holder lookups and cluster stock read model for higher-level planning.
- Scope boundary:
  - In scope: refresh loop, item normalization/storage, holder/stock queries.
  - Out of scope: session authentication lifecycle, consolidation job execution state.

## Owning Code Paths

- `src/core/inventory/interface/inventory-provider.ts`
  - `InventoryProvider`, `InventoryQuery`, `InventoryItem` contracts.
- `src/core/inventory/interface/inventory-repository.ts`
  - Holdings persistence and query port.
- `src/core/inventory/usecase/refresh.ts`
  - Refresh orchestration (`refreshAll`).
- `src/core/inventory/usecase/stock.ts`
  - Cluster stock aggregation (`getStock`).
- `src/adapter/steam/steam-authenticated-inventory-provider.ts`
  - Steam inventory fetch adapter (public/auth cookie path).
- `src/adapter/steam/tf2-sku.ts`
  - SKU normalization helper.
- `src/adapter/persistence/prisma/prisma-bot-inventory-repository.ts`
  - Prisma implementation for item/holding storage and SKU queries.
- `src/presentation/command/bot.ts`
  - `bot refresh`, `bot watch` command wiring.
- `src/presentation/command/ls.ts`
  - `ls items`, `ls stock` command wiring.
- `src/app/bootstrap.ts`
  - Wires provider + repositories + refresh/stock services.

## Data Contracts / Persistence

- Core contracts:
  - `BotInventoryRepository.replaceBotHoldings`
  - `BotInventoryRepository.listBotsBySku`
  - `BotInventoryRepository.listBotSkuHoldings`
- Persistence models:
  - `Item` (`appId`, `contextId`, `sku`, `itemKey`, `name`, `marketHashName`, `iconUrl`)
  - `BotHasItem` (`botId`, `itemId`, `amount`, `rawPayload`, `lastSeenAt`)
- Repository semantics:
  - `replaceBotHoldings` runs replace-style update per bot/app/context (upsert current, delete stale).

## Main Flows

### Flow: `bot refresh`

1. CLI calls `runRefreshOnce` in `src/index.ts`.
2. `BotInventoryRefreshService.refreshAll` bulk-loads bots with sessions.
3. Skips bot when session is missing/expired/no cookies.
4. Fetches inventory via `SteamAuthenticatedInventoryProvider`.
5. Stores normalized holdings via `replaceBotHoldings`.
6. Returns summary (`updated/skipped/failed/errors`).

### Flow: `bot watch`

1. Parses `--interval-seconds` and validates positive number.
2. Runs `bot refresh` loop forever with sleep interval.

### Flow: `ls items`

1. `PrismaBotInventoryRepository.listBotsBySku` filters by `appId/contextId/sku`.
2. Returns holder list sorted by bot name.

### Flow: `ls stock`

1. `ClusterStockService.getStock` reads `listBotSkuHoldings`.
2. Aggregates `totalAmount` and returns detailed holders rows.
3. CLI prints total + per-bot amounts.

## CLI Usage

### Refresh once

```bash
npm run dev -- bot refresh --app-id 440 --context-id 2
```

### Refresh loop

```bash
npm run dev -- bot watch --app-id 440 --context-id 2 --interval-seconds 120
```

### SKU holder query

```bash
npm run dev -- ls items --app-id 440 --context-id 2 --sku <sku>
```

### Cluster stock query

```bash
npm run dev -- ls stock --app-id 440 --context-id 2 --sku <sku>
```

## Failure / Recovery Policy

- Skip policy:
  - Missing/expired/cookieless sessions are counted as skipped, not failed.
- Fetch failure:
  - Per-bot fetch errors are isolated in `errors`; other bots continue.
- Snapshot consistency:
  - Each bot refresh is transactional inside repository replace operation.

## Troubleshooting

- `Steam inventory request failed: 403 Forbidden`
  - Session likely expired or invalid; run `bot reauth`.
- `No bots hold this item.`
  - No matching `sku` in latest snapshot; refresh first and verify SKU.
- Too many skipped bots in refresh
  - Check `ls sessions` and renew invalid sessions.
