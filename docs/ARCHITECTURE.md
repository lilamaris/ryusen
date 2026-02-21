# Architecture

## Goal
- Separate core inventory contracts from infrastructure implementation and presentation entrypoints.

## Directory Layout
- `src/core/provider/inventory-provider.ts`
  - Defines core inventory contract types.
  - `InventoryItem` and `InventoryProvider<TQuery>` live here.
- `src/adapter/steam/steam-inventory-provider.ts`
  - Contains `SteamInventoryProvider` implementation for Steam Web inventory API.
  - Contains Steam-specific query/type mapping (`SteamInventoryQuery`, paging response mapping).
- `src/presentation/`
  - `cli.ts`: CLI table renderer.
  - `tui.ts`: terminal UI renderer.
  - `web.ts`: web UI renderer.
- `src/index.ts`
  - Composition root. Wires provider (`SteamInventoryProvider`) to presentation commands.

## Dependency Direction
- `core` has no dependency on adapters or presentation.
- `adapter` depends on `core` contracts.
- `presentation` depends on `core` contracts and query type for command input.
- `index.ts` assembles concrete adapter + presentation.

## Notes
- Current adapter path is `adapter/steam` as requested.
- If more providers are added later, place each provider implementation under `src/adapter/<provider>/`.
