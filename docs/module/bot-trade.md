# Bot Trade Module

## Purpose

- Coordinate Steam trade offers between managed bots so operators can move inventory from one authenticated bot to another via the official Steam trade flow.
- Scope boundary:
  - In scope: CLI-driven offer creation, selecting the assets to send, calling Steam endpoints, and surfacing the resulting offer link.
  - Out of scope: automatic acceptance, bidirectional compensation, or persistent multiprocessing of trade jobs.

## Owning Code Paths

- `src/core/trade/interface/trade-offer-gateway.ts`
  - Contract that describes how to push a trade offer through Steam.
- `src/core/trade/usecase/trade.ts`
  - Core orchestration that resolves bots, gathers assets, resolves recipient trade token, and delegates to the trade gateway.
- `src/core/session/usecase/session.ts`
  - `bot set-trade-token` 처리와 bot metadata 갱신.
- `src/adapter/steam/trade/trade-offer-gateway.ts`
  - Steam implementation of the gateway that posts to `/tradeoffer/new/send`.
- `src/adapter/steam/inventory/authenticated-inventory-provider.ts`
  - Supplies inventory data (with asset IDs) that the trade usecase needs to build offers.
- `src/presentation/command/bot.ts`
  - `bot trade` wiring that parses CLI arguments and prints the offer summary/link.
- `src/app/bootstrap.ts`
  - Instantiates the gateway and `BotTradeService`, making it available to the CLI.

## Data Contracts / Persistence

- Input: `fromBotName`, `toBotName`, optional `toBotTradeToken`, `appId`, `contextId`, `sku`, `amount`, optional message.
- `TradeOfferAsset` model (assetId, appId, contextId, amount) describes what each bot contributes to the offer.
- `Bot.tradeToken` stores the recipient access token from each bot's trade URL (nullable).
- No trade-offer history table yet; metadata is currently reported to the CLI and left for future tracking.

## Main Flows

### Flow: `bot trade`

1. `bot trade` parses the source/target bot names, SKU, amount, app/context IDs, and optional message.
2. `BotTradeService` loads the `from` bot’s session cookies and validates the session is active.
3. Inventory from the authenticated provider is filtered to collect enough asset entries for the requested SKU.
4. Recipient token is resolved in priority: CLI `--to-trade-token` > `to` bot stored `tradeToken`.
5. The assembled list of `TradeOfferAsset` entries plus metadata is sent to `SteamTradeOfferGateway.createTradeOffer`.
6. The CLI prints a summary row and the generated Steam trade offer URL; manual acceptance remains the operator’s responsibility.

### Flow: `bot set-trade-token`

1. `bot set-trade-token --name --token` receives token value.
2. `BotSessionService.setTradeToken` validates bot existence and non-empty token.
3. Repository persists token into `Bot.tradeToken`.

## CLI Usage

### Source → target transfer

```bash
npm run dev -- bot trade \
  --from <source-bot> \
  --to <target-bot> \
  [--to-trade-token <token>] \
  --sku <defindex;quality;...> \
  --amount <count> \
  [--app-id 440] \
  [--context-id 2] \
  [--message "Optional memo"]
```

- `--from`: managed bot that owns the session/web cookies.
- `--to`: recipient bot name; the CLI ensures both bots are registered.
- `--sku`: TF2-style SKU to identify the item family.
- `--amount`: positive integer of items to request.
- `--to-trade-token`: recipient bot trade token (needed when bots are not Steam friends or recipient profile/privacy requires token link).
- `--to-trade-token` omitted 시 저장된 `to` 봇의 `tradeToken`을 자동 사용.
- Defaults: `app-id` 440, `context-id` 2.
- Output: table row with trade offer ID, source/target/sku/amount plus a printed offer URL.

### Register recipient trade token

```bash
npm run dev -- bot set-trade-token --name <bot-name> --token <trade-token>
```

- `trade-token`은 해당 계정의 trade offer URL (`.../new/?partner=...&token=...`) 에서 `token` 값.

## Failure / Recovery Policy

- Validation fails when:
  - Either bot name is unknown.
  - Source bot is not tradable yet (`onboardingState` is `ONBOARDING_LOCKED` or `AUTH_PENDING_CODE`).
  - No active session exists for the source bot or the session has expired.
  - Requested amount exceeds available quantity in the specified inventory.
- External failures (Steam network errors, missing cookies, rejected trade offer) are surfaced from `SteamTradeOfferGateway`.
- Retry manually after fixing the root cause (refresh session, ensure Steam guard approval, run another `bot trade`).

## Troubleshooting

- `Source bot has no authenticated session`
  - Run `bot connect`/`bot reauth` for that bot and ensure the session cookies exist.
- `Insufficient quantity of <sku>`
  - Confirm the source bot holds enough items using `view cli`/`ls items`.
- `Unknown error while creating trade offer`
  - Check Steam guard prompts, confirm cookies are valid, and verify Steam community is reachable; try again once `bot trade` can log in manually.
- `Steam trade offer request failed: 401 Unauthorized`
  - Usually caused by invalid cookie header/session mismatch. Reauthenticate `--from` bot and retry; if recipient requires trade-link token, pass `--to-trade-token`.

## Change Log Notes

- Added Steam trade offer orchestration in place of the old trade-consolidation job tracking so operators can work directly with Steam’s offer system.
