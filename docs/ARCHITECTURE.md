# ARCHITECTURE.md

## Purpose

This document is a routing map, not a full implementation spec.
Use it to identify the feature/module you are changing, then read only the relevant `docs/module/*.md`.

Detailed behavior, flow, and CLI usage live in module docs.

## Feature Routing

- Bot identity/session/authentication
  - Module doc: `docs/module/bot-session.md`
  - Main commands: `bot create`, `bot connect`, `bot reauth`, `ls sessions`, `ls bots`
- Inventory refresh and holdings persistence
  - Module doc: `docs/module/inventory-refresh.md`
  - Main commands: `bot refresh`, `bot watch`, `ls items`, `ls stock`
- Inventory query/view rendering (CLI/TUI/Web)
  - Module doc: `docs/module/inventory-view.md`
  - Main commands: `view cli`, `view tui`, `view web`
- Control-bot consolidation planning and manual settlement
  - Module doc: `docs/module/trade-consolidation.md`
  - Main commands: `trade consolidate`, `trade jobs`, `trade leg-complete`, `trade leg-fail`

If your task spans multiple features, read all relevant module docs.

## System Boundaries

- `core`: domain types, ports, use cases
- `adapter`: infrastructure implementations (Prisma, Steam)
- `presentation`: CLI/TUI/Web command and rendering
- `app/bootstrap.ts`: dependency wiring
- `index.ts`: entrypoint and process lifecycle

Dependency direction:
- `core` has no dependency on `adapter`/`presentation`
- `adapter` depends on `core` contracts
- `presentation` depends on `core` usecases/contracts

## Doc Update Policy

Update this file only when routing/boundaries change, such as:
- a new feature/module is introduced
- ownership of a command/flow moves to another module
- dependency boundaries or layer responsibilities change

For behavior/flow/CLI detail changes, update the relevant `docs/module/*.md` instead.
