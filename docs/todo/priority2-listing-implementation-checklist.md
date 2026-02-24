# Priority 2 Implementation Checklist

목표: 가격/재고 기반 자동 Listing 실행을 위해 정책 입력부터 실행 파이프라인까지 단계적으로 구현한다.

## Phase 1. Policy Input (done)

- [x] `ListingPolicy` 모델 추가 (`source`, `sku`, `minMarginBps`, `maxExposure`, `targetBotName`, `enabled`)
- [x] 정책 저장소/유스케이스 추가
- [x] CLI 정책 명령 추가 (`listing policy set/list/disable`)
- [x] 문서 라우팅 추가 (`docs/module/listing-automation.md`)

## Phase 2. Decision Engine

- [ ] 가격 캐시 + 재고 입력 계약 정의
- [ ] Listing 조건 계산(usecase) 구현
- [ ] 스킵 사유(reason code) 분류 추가
- [ ] 단위 테스트 추가

## Phase 3. Execution Adapter

- [ ] Listing gateway port 추가 (`createOrUpdateListing`)
- [ ] 1개 소스 adapter 구현
- [ ] 외부 오류를 retryable/fatal로 분류

## Phase 4. Job Integration

- [ ] `LISTING_UPSERT` JobType 추가
- [ ] enqueue command 추가 (`job enqueue-listing` 또는 `listing enqueue`)
- [ ] worker handler 연결
- [ ] 실행/실패 이력 확인 테스트

## Phase 5. Safety

- [ ] 가격 이상치 차단 규칙
- [ ] 재고 부족 차단 규칙
- [ ] idempotency key/중복 생성 방지
- [ ] rate-limit backoff 정책

## Definition of Done

- [ ] 정책이 활성 상태일 때 조건 충족 SKU가 listing job으로 생성됨
- [ ] worker가 listing job을 실행하고 상태를 기록함
- [ ] 중복 실행 시 동일 listing이 중복 생성되지 않음
