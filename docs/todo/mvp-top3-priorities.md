# MVP Top 3 Priorities

MVP 관점에서 지금 가장 먼저 진행할 과제 3개를 우선순위 순서대로 정리한다.

## Priority 1) 거래/리스팅 오케스트레이션 + 작업 추적

선행 이유:
- 자동 Listing과 incoming trade 자동 판단은 모두 "작업 상태/재시도/실패 추적" 기반이 필요하다.
- 현재는 단발성 명령 중심이라, 자동화 루프를 안정적으로 운영하기 어렵다.

TODO:
- [x] `listing/trade` 공통 Job 모델 정의 (상태, 재시도 횟수, 마지막 에러, 생성/갱신 시각)
- [x] Worker 실행 루프 정의 (`claim -> execute -> complete/fail/retry`)
- [x] 최소 운영 명령 추가 (`job list`, `job retry`, `job fail-reason`)
- [x] 실패 분류 기준 정리 (일시적 실패 vs 치명적 실패)
- [x] 단위 테스트 + 기본 통합 테스트 추가

완료 기준:
- 작업 1건이 `pending -> running -> completed/failed`로 추적된다.
- 실패 시 자동 재시도 또는 수동 재큐(requeue)가 가능하다.
- 운영자가 CLI로 현재 상태와 실패 원인을 확인할 수 있다.

## Priority 2) 가격 기반 자동 Listing 생성

선행 이유:
- 가격 조회(`ls price`)와 토큰 저장은 구현되어 있어, 바로 자동 Listing으로 연결 가능한 상태다.
- MVP 가치(수익화/운영 자동화)를 가장 빨리 확인할 수 있다.

TODO:
- [x] Listing 전략 입력 정의 (SKU, 기준가, 최소 마진, 최대 재고 노출량)
- [ ] 가격 캐시 + 재고를 이용한 Listing 생성 조건 계산
- [ ] Listing 생성/수정 어댑터 인터페이스 설계 및 1개 소스 구현
- [ ] 오케스트레이션 Job과 연결 (Priority 1 모델 사용)
- [ ] 보호 장치 추가 (가격 이상치, 재고 부족, rate-limit 대응)

완료 기준:
- 지정 SKU에 대해 조건 충족 시 Listing 작업이 자동 생성된다.
- 생성/실패 결과가 Job 상태에 기록된다.
- 동일 조건 반복 실행 시 중복 Listing 생성이 방지된다(idempotent).

## Priority 3) incoming trade 자동 승낙/거절 판단 엔진

선행 이유:
- Listing 자동화 이후 실제 체결 처리 자동화를 담당하는 핵심 단계다.
- 완전 자동 운영 전환의 마지막 기능 축이다.

TODO:
- [ ] incoming offer 수집 어댑터 구현 (폴링 주기/대상 봇 기준)
- [ ] 판단 규칙 정의 (허용 상대, 아이템/수량 일치, 최소 이득 조건, 블랙리스트)
- [ ] `accept/reject/manual-review` 3분기 처리 구현
- [ ] 고위험 조건 수동 대기 큐 도입 (자동 승인 금지 규칙)
- [ ] 감사 로그 저장 (왜 승낙/거절했는지 근거)

완료 기준:
- incoming offer가 규칙에 따라 자동 분류/처리된다.
- 위험 조건은 자동 승인되지 않고 수동 검토로 이동한다.
- 각 판단 결과에 근거(reason code)가 남는다.

## Out of MVP (후순위)

- 운영 대시보드 고도화(상태 모니터링/알림): 위 3개가 안정화된 뒤 진행
