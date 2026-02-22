# Bot Session Module

## Purpose

- Manage bot identity, Steam authentication, and session lifecycle.
- Keep one current session per bot and expose session validity for operations that depend on authenticated cookies.
- Manage declarative bot/session sync from YAML files.
- Manage 2FA authenticator bootstrap state (`enableTwoFactor`) and trade lock window.
- Manage per-bot backpack.tf integration credentials (access token).
- Scope boundary:
  - In scope: bot create/connect/reauth/sync, session validity checks, OTP/manual confirmation prompts, bot secret sync, authenticator bootstrap and onboarding lock state transition.
  - Out of scope: inventory fetch/storage logic, consolidation planning logic.

## Owning Code Paths

- `src/core/session/type/session.ts`
  - `Bot`, `BotSession`, `BotSessionStatus` domain types.
- `src/core/session/interface/session-repository.ts`
  - Bot/session persistence port.
- `src/core/session/interface/auth-gateway.ts`
  - Steam credential/guard auth port.
- `src/core/session/usecase/session.ts`
  - Main session/secret sync use case orchestration.
- `src/adapter/prisma/session/session-repository.ts`
  - Prisma implementation for bot/session persistence.
- `src/adapter/steam/session/auth-gateway.ts`
  - `steam-session` based auth gateway implementation.
- `src/adapter/steam/session/mobile-auth-gateway.ts`
  - Mobile-app auth + `enableTwoFactor/finalizeTwoFactor` orchestration.
- `src/presentation/command/bot.ts`
  - `bot create/connect/reauth/sync/sync-secrets/bootstrap-authenticator/set-backpack-token` command wiring.
- `src/presentation/command/bot-sync-yaml.ts`
  - YAML declaration parsing for accounts/secrets.
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
  - `Bot` (`name`, `steamId`, `accountName`, `sharedSecret`, `identitySecret`, `revocationCode`, `onboardingState`, `onboardingStartedAt`, `tradeLockedUntil`)
  - `BotSession` (`botId`, `sessionToken`, `webCookies`, `expiresAt`, `lastCheckedAt`)
  - `BotBackpackIntegration` (`botId`, `accessToken`, `lastRateLimitedAt`)

## Main Flows

### Flow: `bot create`

1. `presentation/command/bot.ts` parses required bot identity args.
2. `BotSessionService.registerBot` calls repository `createBot`.
3. Bot metadata is stored without authentication/session creation.

### Flow: `bot connect`

1. CLI collects password and guard prompts callbacks.
2. `BotSessionService.addOrAuthenticateBot` authenticates via `SteamAuthGateway`.
3. Guard code 입력이 필요하면 현재 대상 봇 메타데이터(`mode`, `bot`, `account`, `steamId`)가 박스 형태로 표시됨.
4. If bot exists, validates `steamId/accountName` consistency.
5. Upserts `BotSession` with `sessionToken`, `webCookies`, `expiresAt`.

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

### Flow: `bot sync`

1. CLI reads account YAML (`steamId`, `account`, `password`, `alias`).
2. Optional secrets YAML is loaded and keyed by `steamId`.
3. `BotSessionService.syncBotsFromDeclaration`:
  - upserts bot identity using `steamId` as stable key and `alias` as bot name.
  - optionally stores `sharedSecret`/`identitySecret`.
  - authenticates each account and upserts session cookies/expiry.
  - each Steam Guard prompt includes current account metadata box so operator can identify which bot needs OTP.
4. CLI prints per-bot sync result rows and summary counts.

### Flow: `bot sync-secrets`

1. CLI reads secrets YAML keyed by `steamId`.
2. `BotSessionService.syncBotSecretsFromDeclaration` updates only registered bots.
3. CLI prints updated/error rows and summary counts.

### Flow: `bot bootstrap-authenticator`

1. CLI receives target bot name and account password.
2. `SteamMobileTwoFactorGateway` authenticates as `MobileApp` and calls Steam `enableTwoFactor`.
3. Operator enters activation code (SMS/email) and gateway finalizes via `finalizeTwoFactor`.
4. Service stores `sharedSecret`/`identitySecret`/`revocationCode`, marks bot `ONBOARDING_LOCKED`, and sets `tradeLockedUntil = onboardingStartedAt + 15 days`.
5. After lock expiry, listing/session checks auto-transition the bot state to `AUTO_READY`.

### Flow: `bot set-backpack-token`

1. CLI receives bot name and backpack.tf access token.
2. `BotSessionService.setBackpackAccessToken` validates non-empty token.
3. Repository upserts `BotBackpackIntegration` row by bot identity.
4. Later pricing/listing modules resolve token by bot name for backpack API calls.

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

### Declarative session sync

```bash
npm run dev -- bot sync --from-yaml-file <bots.yaml> [--secrets-yaml-file <secrets.yaml>]
```

- `--from-yaml-file` / `--secrets-yaml-file` 는 프로젝트 루트 기준 `.ryusen/secret` 내부 파일명으로 해석됨.
- 예: `--from-yaml-file bots.yaml` 는 `.ryusen/secret/bots.yaml` 를 읽음.
- `--from-yaml-file` 생략 시 기본값은 `bots.yaml`.

`bots.yaml`:

```yaml
bots:
  - steamId: "7656119..."
    account: "bot_login_id"
    password: "bot_password"
    alias: "bot-alpha"
```

`secrets.yaml`:

```yaml
secrets:
  "7656119...":
    sharedSecret: "<sharedSecret>"
    identitySecret: "<identitySecret>"
```

### Declarative secret-only sync

```bash
npm run dev -- bot sync-secrets --from-yaml-file <secrets.yaml>
```

- `--from-yaml-file` 생략 시 기본값은 `secrets.yaml`.

### Bootstrap authenticator and extract secrets automatically

```bash
npm run dev -- bot bootstrap-authenticator --name <bot-name>
```

### Set backpack.tf access token

```bash
npm run dev -- bot set-backpack-token --name <bot-name> --token <backpack-access-token>
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
- Secret sync:
  - `bot sync-secrets` fails per row when steamId is not registered.
- Auth guard actions:
  - Device/email OTP and confirmation-wait are handled interactively.
- Session validity:
  - Expired/missing session is not auto-renewed; operator runs `bot reauth`.
- Trade automation readiness:
  - `onboardingState=MANUAL_ONLY` → tradable `true` (manual confirmation required)
  - `onboardingState=AUTO_READY` → tradable `true`
  - `onboardingState=ONBOARDING_LOCKED` and `tradeLockedUntil` not reached → tradable `false`
  - `onboardingState=ONBOARDING_LOCKED` and lock expired → auto-transition to `AUTO_READY`
  - `sharedSecret` missing keeps automation mode `MANUAL`

## Troubleshooting

- `Bot not found: <name>`
  - Bot is not registered or `--name` is wrong.
- `Bot already exists with different steamId/accountName`
  - Attempted to attach conflicting identity to existing bot name.
- `Steam login succeeded but no sessionid cookie was returned`
  - Steam auth succeeded but web cookie payload is incomplete; retry auth.
