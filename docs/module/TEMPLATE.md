# <Module Name> Module

## Purpose

- What problem this module solves.
- Scope boundaries: what is in/out of this module.

## Owning Code Paths

- `src/core/...`
  - Core domain types, ports, use cases used by this module
- `src/adapter/...`
  - Infrastructure adapters used by this module
- `src/presentation/...`
  - CLI/TUI/Web commands or handlers wired to this module
- `src/app/bootstrap.ts`
  - How dependencies are assembled for this module

## Data Contracts / Persistence

- Core input/output contracts used in this module
- Prisma models/tables involved (if any)
- Status/state enums and their meanings (if any)

## Main Flows

### Flow: <action-name-1>

1. Entry command/request
2. Core use case orchestration
3. Adapter/persistence interaction
4. Output/result and failure behavior

### Flow: <action-name-2>

1. ...

Include action-by-action flow for all important commands in this module.

## CLI Usage

### <command>

```bash
npm run dev -- <command> <options>
```

- Option descriptions and defaults
- Expected output summary

Repeat for each command owned by this module.

## Failure / Recovery Policy

- Validation failures
- External dependency failures (network/auth/db)
- Retry/manual intervention policy (if applicable)

## Troubleshooting

- Common error message -> cause -> fix
- Operational checks (DB, auth/session, required envs)

## Change Log Notes (Optional)

- Brief notes for important semantic changes when this module evolves
