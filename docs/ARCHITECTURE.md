# Architecture.md

## Goal

- Separate core inventory contracts from infrastructure implementation and presentation entrypoints.
- Persist bot/session state so runtime flows can reuse valid sessions instead of relying on stateless calls.
- Support interactive Steam re-authentication with OTP prompts for new bot onboarding and session refresh.

## Directory Layout

- `src/core/provider/inventory-provider.ts`
  - Defines core inventory contract types.
  - `InventoryItem`, `InventoryQuery`, and `InventoryProvider<TQuery>` live here.
- `src/core/bot/bot-session.ts`
  - Bot and bot-session domain types.
- `src/core/port/bot-session-repository.ts`
  - Persistence port for bot/session lifecycle.
- `src/core/port/steam-auth-gateway.ts`
  - Auth gateway port for Steam credential + guard-code login.
- `src/core/usecase/bot-session-service.ts`
  - Use case for bot register, add+authenticate, re-authenticate, and session status checks.
- `src/adapter/steam/steam-inventory-provider.ts`
  - `SteamInventoryProvider` implementation for Steam Web inventory API.
- `src/adapter/steam/steam-auth-gateway.ts`
  - `SteamSessionAuthGateway` implementation using `steam-session`.
- `src/adapter/persistence/prisma/prisma-bot-session-repository.ts`
  - Prisma implementation of bot/session repository port.
- `src/presentation/`
  - `cli.ts`: CLI table renderer.
  - `tui.ts`: terminal UI renderer.
  - `web.ts`: web UI renderer.
- `src/index.ts`
  - Composition root. Wires adapters to use cases and presentation commands.
  - Hosts interactive CLI prompt flow for password/OTP input.

## Dependency Direction

- `core` has no dependency on adapters or presentation.
- `adapter` depends on `core` contracts.
- `presentation` depends on `core` contracts and query type for command input.
- `index.ts` assembles concrete adapter + presentation.

## Persistence Model

- `Bot`
  - Unique bot identity (`name`, `steamId`, `accountName`).
- `BotSession`
  - One current session per bot (`botId` unique).
  - Stores `sessionToken`, `expiresAt`, `lastCheckedAt`.

## Session Management Flow

- `bot add`
  - Authenticates via Steam credentials first, then creates/updates bot session state.
  - If Steam Guard is required, OTP or confirmation prompt is requested interactively.
- `bot auth`
  - Re-authenticates existing bot using stored `accountName` and prompted password/OTP.
  - Refreshes persisted session data.
- `bot session-check`
  - Returns current validity of one bot or all bots using persisted session expiry metadata.
  - Batch check path uses one repository read for bots+sessions, then updates `lastCheckedAt` per existing session.

## Update Policy

If code changes meaningfully (boundaries, contracts, flows, domain semantics), update this document in the same change set.
(See `docs/RULE.md` for the detailed checklist.)

## Notes

- Current Steam adapter path is `adapter/steam`.
- If more providers are added later, place each provider implementation under `src/adapter/<provider>/`.
