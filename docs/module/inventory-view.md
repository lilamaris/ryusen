# Inventory View Module

## Purpose

- Resolve inventory query targets (`--name` / `--all`) and render inventory in CLI/TUI/Web.
- Keep presentation paths read-only and avoid persistence side effects.
- Scope boundary:
  - In scope: target resolution policy, view fetch orchestration, rendering.
  - Out of scope: periodic refresh persistence, bot auth/session mutation.

## Owning Code Paths

- `src/core/inventory/usecase/query.ts`
  - Target resolution from bot/session state and fallback policy.
- `src/core/inventory/usecase/view.ts`
  - Fetches resolved targets and aggregates skipped/failures.
- `src/core/inventory/interface/inventory-provider.ts`
  - Shared inventory provider contract.
- `src/adapter/steam/inventory/authenticated-inventory-provider.ts`
  - Concrete provider used by view flows.
- `src/presentation/command/view.ts`
  - `view cli`, `view tui`, `view web` command wiring.
- `src/presentation/cli.ts`
  - Table rendering for CLI view.
- `src/presentation/tui.ts`
  - Blessed-based terminal table rendering.
- `src/presentation/web/server.ts`
  - Web server start.
- `src/presentation/web/routes.ts`
  - Web routes (`/`, `/inventory`) and response rendering.
- `src/presentation/web/query.ts`
  - Web query parsing helpers.
- `src/presentation/web/template.ts`
  - Simple HTML template.
- `src/app/bootstrap.ts`
  - Wires query/view services and provider.

## Data Contracts / Persistence

- Core contracts:
  - `BotInventoryQueryService.resolveByBotName`
  - `BotInventoryQueryService.resolveAllBots`
  - `BotInventoryViewService.fetchBySelection`
- Skip reasons:
  - `bot_not_found`, `no_session`, `expired_session`, `missing_web_cookies`
- Persistence behavior:
  - None. View path does not write to DB.

## Main Flows

### Flow: `view cli`

1. Parse options (`--name` xor `--all`, app/context, fallback flag).
2. `BotInventoryViewService.fetchBySelection` resolves targets through query service.
3. Provider fetches each target inventory.
4. CLI renders merged rows via `renderCliByBots`.
5. Skipped/failure warnings printed as separate tables.

### Flow: `view tui`

1. Same resolve/fetch flow as CLI.
2. Renders merged rows via `runTuiByBots`.
3. Shows keyboard exit hints (`q`, `Ctrl+C`).

### Flow: `view web`

1. Starts Express server on `--port`.
2. `GET /` renders form.
3. `GET /inventory` parses `steamId/appId/contextId` query and fetches provider.
4. Returns HTML table response or error message.

## CLI Usage

### CLI view

```bash
npm run dev -- view cli --name <bot-name> --app-id 730 --context-id 2
npm run dev -- view cli --all --app-id 730 --context-id 2 --allow-public-fallback
```

### TUI view

```bash
npm run dev -- view tui --name <bot-name> --app-id 730 --context-id 2
```

### Web view

```bash
npm run dev -- view web --port 3000
```

## Failure / Recovery Policy

- Invalid selection:
  - `--name` and `--all` cannot be used together.
  - One of them is required.
- Per-target fetch failures:
  - Collected in `failures`; other targets continue.
- No writes:
  - View path is safe for read-only diagnostics.

## Troubleshooting

- `One of --name or --all is required`
  - Add explicit target selection.
- Many skipped targets
  - Use `--allow-public-fallback` or refresh sessions with `bot reauth`.
- Web `steamId is required`
  - Missing `steamId` query input for `/inventory`.
