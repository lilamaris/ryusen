# Inventory Refresh Module

## Purpose

`inventory-refresh` 모듈은 관리되는 봇 계정의 인벤토리를 주기적으로 최신화하고, 아이템 보유 상태를 `Bot <-> BotHasItem <-> Item` 구조로 저장합니다.

## Related Modules

- `src/core/usecase/bot-inventory-refresh-service.ts`
  - 전체 봇 갱신 오케스트레이션 (`refreshAll`)
- `src/core/provider/inventory-provider.ts`
  - 공통 인벤토리 조회 계약 (`InventoryProvider`, `InventoryQuery`)
- `src/core/port/bot-inventory-repository.ts`
  - 아이템/보유 상태 저장 포트
- `src/adapter/steam/steam-authenticated-inventory-provider.ts`
  - Steam 공개/인증 조회를 단일 구현으로 처리
- `src/adapter/persistence/prisma/prisma-bot-inventory-repository.ts`
  - Prisma 기반 `Item`, `BotHasItem` 갱신 구현
- `src/index.ts`
  - CLI 명령(`bot refresh-once`, `bot refresh-loop`, `bot item-holders`) 연결

## Data Model

- `Item`
  - `appId`, `contextId`, `sku` 유니크
  - `sku`는 TF2 `def_index` + 속성 토큰 기반 (예: `5033;ks-1;st`)
  - `itemKey(classid_instanceid)`는 원본 참조값으로 보조 저장
  - 공용 메타(`name`, `marketHashName`, `iconUrl`) 저장
- `BotHasItem`
  - `(botId, itemId)` 유니크
  - `amount`, `lastSeenAt`, `rawPayload` 저장
- `BotSession`
  - 비공개 인벤토리 조회용 `webCookies` 저장

## Main Flow

1. `BotSessionRepository.listBotsWithSessions`로 봇/세션을 일괄 조회
2. 만료 세션 또는 쿠키 없는 세션은 스킵
3. 유효 세션은 authenticated Steam inventory 조회
4. 봇별 아이템 스냅샷을 `replaceBotHoldings`로 치환 저장
5. 결과 집계(`updated/skipped/failed`) 출력

## CLI Usage

### 1회 갱신

```bash
npm run dev -- bot refresh-once --app-id 440 --context-id 2
```

### 주기 갱신 (기본 120초)

```bash
npm run dev -- bot refresh-loop --app-id 440 --context-id 2 --interval-seconds 120
```

### 특정 아이템 보유 봇 조회

```bash
npm run dev -- bot item-holders --app-id 440 --context-id 2 --sku <tf2-sku>
```

## Troubleshooting

- 봇이 계속 `skipped`로 나오는 경우
  - `bot auth`로 세션 재인증해서 `webCookies`를 갱신하세요.
- `Steam inventory request failed: 403 Forbidden`
  - 세션 만료/쿠키 무효 가능성이 큽니다. 재인증 후 재시도하세요.
- 조회는 되지만 `item-holders` 결과가 비어 있는 경우
  - `sku`를 정확히 입력했는지 확인하세요. (`def_index` 누락 아이템은 `raw-<classid_instanceid>` 형식)
