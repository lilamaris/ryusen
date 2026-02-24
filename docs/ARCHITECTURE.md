# ARCHITECTURE.md

## Purpose

This document is a routing map, not a full implementation spec.
Use it to identify the feature/module you are changing, then read only the relevant `docs/module/*.md`.

Detailed behavior, flow, and CLI usage live in module docs.

## Feature Routing

- Bot identity/session/authentication
  - Module doc: `docs/module/bot-session.md`
  - Main commands: `bot create`, `bot connect`, `bot reauth`, `bot sync`, `bot sync-secrets`, `bot bootstrap-authenticator`, `bot set-backpack-token`, `ls sessions`, `ls bots`
- Inventory refresh and holdings persistence
  - Module doc: `docs/module/inventory-refresh.md`
  - Main commands: `bot refresh`, `bot watch`, `ls items`, `ls stock`
- Inventory query/view rendering (CLI/TUI/Web)
  - Module doc: `docs/module/inventory-view.md`
  - Main commands: `view cli`, `view tui`, `view web`
- Bot-to-bot trade offers
  - Module doc: `docs/module/bot-trade.md`
  - Main commands: `bot trade`, `bot set-trade-token`
- External market pricing
  - Module doc: `docs/module/pricing.md`
  - Main commands: `ls price`
- Job orchestration and worker monitoring
  - Module doc: `docs/module/job-orchestration.md`
  - Main commands: `job enqueue-trade`, `job list`, `job inspect`, `job fail-reason`, `job retry`, `job cancel`, `job worker`

If your task spans multiple features, read all relevant module docs.

## System Boundaries

- `core`: feature-first modules (`session`, `inventory`, `trade`, `pricing`, `job`) with `type/`, `interface/`, `usecase/`
- `adapter`: infra-first modules (`steam`, `prisma`, `backpack`); each infra groups implementations by feature (`session`, `inventory`, `trade`, `pricing`, `job`)
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
