# Trade Consolidation Module

## Purpose

`trade-consolidation` 모듈은 클러스터 재고에서 특정 SKU 수량을 `Control Bot`으로 집결시키기 위한
all-or-nothing 계획을 생성하고, 수동 Steam 거래 실행을 위한 작업 단위를 영속화합니다.

현재 단계에서는 Steam offer 전송 자동화는 포함하지 않고, 계획/상태 저장에 집중합니다.

## Related Modules

- `src/core/usecase/cluster-stock-service.ts`
  - SKU 기준 클러스터 총량/보유 봇 집계
- `src/core/usecase/control-bot-consolidation-service.ts`
  - control bot 대상 집결 계획 생성 + job/leg 저장
- `src/core/usecase/trade-consolidation-settlement-service.ts`
  - leg 완료/실패 수동 반영 + job 상태 전이
- `src/core/port/trade-consolidation-repository.ts`
  - consolidation job/leg 저장 포트
- `src/adapter/persistence/prisma/prisma-trade-consolidation-repository.ts`
  - Prisma 저장소 구현
- `src/adapter/persistence/prisma/prisma-bot-inventory-repository.ts`
  - SKU 보유량 조회 (`listBotSkuHoldings`)
- `src/presentation/command/trade.ts`
  - `trade consolidate`, `trade jobs`, `trade leg-complete`, `trade leg-fail` CLI wiring
- `src/presentation/command/ls.ts`
  - `ls stock` CLI wiring

## Data Model

- `TradeConsolidationJob`
  - 집결 요청 단위 (`controlBotId`, `appId`, `contextId`, `sku`, `requestedAmount`, `status`)
- `TradeConsolidationLeg`
  - donor -> control 이동 계획 단위 (`fromBotId`, `toBotId`, `amount`, `status`)

상태:
- Job: `PLANNED`, `COMPLETED`, `FAILED`
- Leg: `PLANNED`, `COMPLETED`, `FAILED`

## Main Flow

1. `trade consolidate` 요청으로 control bot 확인
2. `ClusterStockService`로 SKU 총량/보유 봇 조회
3. 총량 부족 시 즉시 실패 (all-or-nothing 사전 검증)
4. control bot 현재 수량을 제외한 부족분을 donor 순서로 분배
5. `TradeConsolidationJob` + `TradeConsolidationLeg`를 `PLANNED` 상태로 저장

수동 반영 단계:
1. Steam에서 실제 거래를 수동으로 실행
2. 성공한 leg는 `trade leg-complete`
3. 실패한 leg는 `trade leg-fail --reason ...`
4. 마지막 planned leg까지 완료되면 job은 자동 `COMPLETED`
5. 하나라도 실패하면 job은 `FAILED`

참고: Steam offer 생성/승인 자동화 및 보상(rollback) 실행은 후속 단계에서 추가 예정입니다.

## CLI Usage

### SKU 클러스터 재고 확인

```bash
npm run dev -- ls stock --sku <sku> --app-id 440 --context-id 2
```

### Control Bot 집결 계획 생성

```bash
npm run dev -- trade consolidate --control-name <control-bot> --sku <sku> --amount <n> --app-id 440 --context-id 2
```

### 저장된 집결 작업 조회

```bash
npm run dev -- trade jobs --limit 20
```

### leg 성공 수동 반영

```bash
npm run dev -- trade leg-complete --job-id <job-id> --leg-id <leg-id>
```

### leg 실패 수동 반영

```bash
npm run dev -- trade leg-fail --job-id <job-id> --leg-id <leg-id> --reason "manual trade rejected"
```

## Troubleshooting

- `Control bot not found`
  - `bot create` 또는 `bot connect`로 control bot이 등록됐는지 확인하세요.
- `Insufficient cluster stock`
  - `ls stock --sku ...`로 실제 총량을 먼저 확인하세요.
- leg가 0개인데 계획이 생성되는 경우
  - control bot이 이미 요구 수량 이상을 보유한 정상 케이스입니다.
