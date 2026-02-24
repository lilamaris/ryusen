# Priority 1 Implementation Checklist

목표: `Job 모델 + 상태 머신 + worker 루프 + 모니터링 CLI`를 최소 기능으로 구현한다.

## Phase 0. Scope Freeze

- [x] 초기 범위를 `TRADE_OFFER_CREATE` 단일 JobType으로 제한
- [x] 상태 집합 확정: `PENDING`, `RUNNING`, `RETRY_WAIT`, `COMPLETED`, `FAILED`, `CANCELED`
- [x] 허용 전이표 확정 및 문서화

## Phase 1. Persistence (Prisma) - 파일 단위 작업 순서

1. [x] `prisma/schema.prisma`
   - `Job`, `JobTransition` 모델 추가
   - 상태/타입 enum 추가
2. [x] `prisma/migrations/<timestamp>_add_job_orchestration/*`
   - migration 생성
3. [x] `src/adapter/prisma/job/job-repository.ts` (new)
   - CRUD + claim + transition persistence 구현

검증:
- [x] `npm run prisma:generate`
- [x] `npm run prisma:deploy`

## Phase 2. Core State Machine - 파일 단위 작업 순서

1. [x] `src/core/job/type/job.ts` (new)
   - Job/Transition 타입 및 전이 enum
2. [x] `src/core/job/interface/job-repository.ts` (new)
   - core port 계약 정의
3. [x] `src/core/job/usecase/job-state-machine.ts` (new)
   - 허용 전이 검증 + 전이 실행 유스케이스
4. [x] `src/core/job/usecase/job-worker.ts` (new)
   - `claim -> running -> execute -> complete/retry/fail` 루프

검증:
- [x] `src/core/job/usecase/*.test.ts` (new)
  - 허용/비허용 전이 테스트
  - retryable/fatal 분기 테스트
  - lease timeout 회수 테스트

## Phase 3. Trade Integration - 파일 단위 작업 순서

1. [x] `src/core/trade/usecase/trade.ts`
   - 직접 실행/큐 실행 경계 정리 (핸들러 입력 계약)
2. [x] `src/presentation/command/bot.ts`
   - `bot trade`에서 job enqueue 경로 또는 `--async` 옵션 추가
3. [x] `src/app/bootstrap.ts`
   - job repository/state machine/worker wiring 추가

검증:
- [x] trade enqueue 후 job이 `pending`으로 기록됨
- [x] worker 실행 시 trade handler 호출 및 상태 전이 기록

## Phase 4. Monitoring Commands - 파일 단위 작업 순서

1. [x] `src/presentation/command/job.ts` (new)
   - `job list`, `job inspect`, `job fail-reason`, `job retry`, `job cancel`, `job worker`
2. [x] `src/index.ts`
   - `job` command group wiring
3. [x] `src/presentation/command/job.test.ts` (optional/new)
   - 최소 파라미터/실패 케이스 검증

검증:
- [x] 실패 원인(`reason code/message`) 조회 가능
- [x] 상태별 필터 조회 가능
- [x] 수동 retry/cancel 제어 가능

## Phase 5. Docs Sync

1. [x] `docs/ARCHITECTURE.md`
   - job orchestration 라우팅 반영 확인
2. [x] `docs/module/job-orchestration.md`
   - 실제 구현 경로/명령/흐름으로 갱신
3. [x] `README.md`
   - `job` 명령 추가 및 로드맵 진행 상태 반영

## Definition of Done

- [x] Job 1건이 `pending -> running -> completed/failed` 전이됨
- [x] retryable 실패는 `retry_wait` 후 재실행됨
- [x] 전이 이력(`JobTransition`)이 누락 없이 기록됨
- [x] 운영자가 CLI로 상태 조회/재시도/취소 가능
- [x] 테스트 통과 (`npm test`)
