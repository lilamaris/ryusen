# Bot Session Module

## Purpose

- Manage bot identity, Steam authentication, and session lifecycle.
- Keep one current session per bot and expose session validity for operations that depend on authenticated cookies.
- Scope boundary:
  - In scope: bot create/connect/reauth, session validity checks, OTP/manual confirmation prompts.
  - Out of scope: inventory fetch/storage logic, consolidation planning logic.

## Owning Code Paths

- `src/core/bot/bot-session.ts`
  - `Bot`, `BotSession`, `BotSessionStatus` domain types.
- `src/core/port/bot-session-repository.ts`
  - Bot/session persistence port.
- `src/core/port/steam-auth-gateway.ts`
  - Steam credential/guard auth port.
- `src/core/usecase/bot-session-service.ts`
  - Main session use case orchestration.
- `src/adapter/persistence/prisma/prisma-bot-session-repository.ts`
  - Prisma implementation for bot/session persistence.
- `src/adapter/steam/steam-auth-gateway.ts`
  - `steam-session` based auth gateway implementation.
- `src/presentation/command/bot.ts`
  - `bot create/connect/reauth` command wiring.
- `src/presentation/command/ls.ts`
  - `ls bots`, `ls sessions` command wiring.
- `src/index.ts`
  - Prompt input bridge (`Steam password`, OTP/confirmation).
- `src/app/bootstrap.ts`
  - Wires repository + gateway + session service.

## Data Contracts / Persistence

- Core contracts:
  - `BotSessionRepository`
    - `createBot`, `findBotByName`, `listBots`, `listBotsWithSessions`
    - `upsertSession`, `findSessionByBotId`, `markSessionChecked`
  - `SteamAuthGateway.authenticateWithCredentials`
- Persistence models:
  - `Bot` (`name`, `steamId`, `accountName`)
  - `BotSession` (`botId`, `sessionToken`, `webCookies`, `expiresAt`, `lastCheckedAt`)

## Main Flows

### Flow: `bot create`

1. `presentation/command/bot.ts` parses required bot identity args.
2. `BotSessionService.registerBot` calls repository `createBot`.
3. Bot metadata is stored without authentication/session creation.

### Flow: `bot connect`

1. CLI collects password and guard prompts callbacks.
2. `BotSessionService.addOrAuthenticateBot` authenticates via `SteamAuthGateway`.
3. If bot exists, validates `steamId/accountName` consistency.
4. Upserts `BotSession` with `sessionToken`, `webCookies`, `expiresAt`.

### Flow: `bot reauth`

1. CLI collects password and guard prompts callbacks.
2. `BotSessionService.reauthenticateBot` resolves bot by name.
3. Authenticates with stored `accountName`.
4. Upserts refreshed session payload.

### Flow: `ls sessions`

1. `ls --name` path:
  - `checkBotSession` -> `findBotByName` -> `findSessionByBotId`.
2. `ls` (all) path:
  - `listBotSessions` -> `listBotsWithSessions` bulk read.
3. Existing sessions are marked checked via `markSessionChecked`.

## CLI Usage

### Register bot metadata only

```bash
npm run dev -- bot create --name <bot-name> --steam-id <steam-id64> --account-name <steam-login-id>
```

### Register/authenticate bot

```bash
npm run dev -- bot connect --name <bot-name> --steam-id <steam-id64> --account-name <steam-login-id>
```

### Re-authenticate existing bot

```bash
npm run dev -- bot reauth --name <bot-name>
```

### List bots

```bash
npm run dev -- ls bots
```

### List session status

```bash
npm run dev -- ls sessions
npm run dev -- ls sessions --name <bot-name>
```

## Failure / Recovery Policy

- Bot consistency guard:
  - `bot connect` rejects existing bot with different `steamId/accountName`.
- Missing bot:
  - `reauth` and `ls sessions --name` fail if bot is not registered.
- Auth guard actions:
  - Device/email OTP and confirmation-wait are handled interactively.
- Session validity:
  - Expired/missing session is not auto-renewed; operator runs `bot reauth`.

## Troubleshooting

- `Bot not found: <name>`
  - Bot is not registered or `--name` is wrong.
- `Bot already exists with different steamId/accountName`
  - Attempted to attach conflicting identity to existing bot name.
- `Steam login succeeded but no sessionid cookie was returned`
  - Steam auth succeeded but web cookie payload is incomplete; retry auth.
