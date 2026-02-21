# Architecture.md

## Goal

- Separate core inventory contracts from infrastructure implementation and presentation entrypoints.
- Persist bot/session state so runtime flows can reuse valid sessions instead of relying on stateless calls.

## Directory Layout

- `src/core/provider/inventory-provider.ts`
  - Defines core inventory contract types.
  - `InventoryItem` and `InventoryProvider<TQuery>` live here.
- `src/core/bot/bot-session.ts`
  - Bot and bot-session domain types.
- `src/core/port/bot-session-repository.ts`
  - Persistence port for bot/session lifecycle.
- `src/core/usecase/bot-session-service.ts`
  - Use case for `bot register`, `bot connect`, and `bot session-check`.
- `src/adapter/steam/steam-inventory-provider.ts`
  - Contains `SteamInventoryProvider` implementation for Steam Web inventory API.
  - Contains Steam-specific query/type mapping (`SteamInventoryQuery`, paging response mapping).
- `src/adapter/persistence/prisma/prisma-bot-session-repository.ts`
  - Prisma implementation of bot/session repository port.
- `src/presentation/`
  - `cli.ts`: CLI table renderer.
  - `tui.ts`: terminal UI renderer.
  - `web.ts`: web UI renderer.
- `src/index.ts`
  - Composition root. Wires adapters to use cases and presentation commands.

## Dependency Direction

- `core` has no dependency on adapters or presentation.
- `adapter` depends on `core` contracts.
- `presentation` depends on `core` contracts and query type for command input.
- `index.ts` assembles concrete adapter + presentation.

## Persistence Model

- `Bot`
  - Unique bot identity (`name`, `steamId`).
- `BotSession`
  - One current session per bot (`botId` unique).
  - Stores `sessionToken`, `expiresAt`, `lastCheckedAt`.

## Update Policy

If code changes meaningfully (boundaries, contracts, flows, domain semantics), update this document in the same change set.
(See `docs/RULE.md` for the detailed checklist.)

## Notes

- Current adapter path is `adapter/steam`.
- If more providers are added later, place each provider implementation under `src/adapter/<provider>/`.
