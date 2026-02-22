# ryusen

다중 Steam 봇 운영을 위한 자동화 시스템입니다.  
최종 목표는 다음 세 가지를 하나의 흐름으로 통합하는 것입니다.

- 다중 봇 세션/인벤토리 운영
- item price provider 기반 가격 감지 및 Listing 생성
- 자동 거래 승낙/거절 판단

현재 README는 **지금 구현된 기능**을 기준으로 작성되어 있으며, 로드맵은 TODO로 분리해 진행 상태를 표시합니다.

## 현재 구현 범위

### 1) Bot Session / Identity

- 봇 등록/연결/재인증
- Steam Guard(OTP/확인 대기) 인터랙티브 처리
- YAML 기반 다중 봇 일괄 동기화 (`bot sync`)
- YAML 기반 secret 동기화 (`bot sync-secrets`)
- Authenticator bootstrap 및 onboarding lock 상태 관리
- bot별 backpack.tf access token 저장 (`bot set-backpack-token`)
- 세션/봇 상태 조회 (`ls bots`, `ls sessions`)

관련 문서: `docs/module/bot-session.md`

### 2) Inventory Refresh / Stock

- 인증 세션 기반 인벤토리 수집
- DB snapshot 갱신 (`bot refresh`, `bot watch`)
- SKU 기준 보유 봇 조회 (`ls items`)
- 클러스터 총 재고 조회 (`ls stock`)

관련 문서: `docs/module/inventory-refresh.md`

### 3) Inventory View (Presentation)

- CLI 렌더링 (`view cli`)
- TUI 렌더링 (`view tui`)
- Web UI 서버 (`view web`, `/`, `/inventory`)
- `--name`/`--all` 대상 선택 및 skip/failure 표시

관련 문서: `docs/module/inventory-view.md`

### 4) Bot Trade Offer

- 관리 중인 봇 간 Steam trade offer 생성 (`bot trade`)
- 수신 봇 trade token 저장 (`bot set-trade-token`)
- 생성된 offer URL 출력(수동 승인 워크플로우)

관련 문서: `docs/module/bot-trade.md`

### 5) External Market Pricing

- 소스별 pricer 인터페이스 기반 가격 조회
- backpack.tf 소스 구현체 제공
- SKU 기준 현재 최우선 매수/매도 호가 조회 (`ls price`)
- 가격 조회 시 bot별 backpack.tf access token 사용
- `Item` 기반 가격 캐시 + 신선도 정책(TTL) 적용

관련 문서: `docs/module/pricing.md`

## 표현 계층 (WebUI / CLI / TUI)

- CLI: 운영 명령 실행 및 테이블 출력
- TUI: 터미널 내 인터랙티브 조회 화면
- WebUI: 브라우저에서 조회 가능한 간단한 서버/페이지

## CLI 명령 요약

실행 기본형:

```bash
npm run dev -- <command>
```

### `bot` 그룹

- `bot create --name --steam-id --account-name`
- `bot connect --name --steam-id --account-name`
- `bot reauth --name`
- `bot set-trade-token --name --token`
- `bot set-backpack-token --name --token`
- `bot bootstrap-authenticator --name`
- `bot sync [--from-yaml-file bots.yaml] [--secrets-yaml-file secrets.yaml]`
- `bot sync-secrets [--from-yaml-file secrets.yaml]`
- `bot refresh [--app-id 440] [--context-id 2]`
- `bot watch [--app-id 440] [--context-id 2] [--interval-seconds 120]`
- `bot trade --from --to --sku --amount [--to-trade-token] [--app-id 440] [--context-id 2] [--message]`

### `ls` 그룹

- `ls bots`
- `ls sessions [--name <bot>]`
- `ls items --sku <sku> [--app-id 440] [--context-id 2]`
- `ls stock --sku <sku> [--app-id 440] [--context-id 2]`
- `ls price --name <bot> --sku <sku> [--source backpack.tf] [--app-id 440] [--context-id 2] [--max-age-seconds 120]`

### `view` 그룹

- `view cli (--name <bot> | --all) [--app-id 730] [--context-id 2] [--allow-public-fallback]`
- `view tui (--name <bot> | --all) [--app-id 730] [--context-id 2] [--allow-public-fallback]`
- `view web [--port 3000]`

## 빠른 시작

### 1) 의존성 설치

```bash
npm install
```

### 2) 환경 변수

`.env` 예시:

```env
DATABASE_URL="postgresql://ryusenbot@localhost:5432/ryusen?schema=public"
```

### 3) Prisma 준비

```bash
npm run prisma:generate
npm run prisma:migrate
```

- 새 스키마 변경으로 마이그레이션 파일을 **생성**할 때: `npm run prisma:migrate -- --name <migration-name>`
- 이미 저장소에 있는 마이그레이션을 DB에 **적용만** 할 때: `npm run prisma:deploy`
- 마이그레이션 이력/의도: `prisma/migrations/README.md`

### 4) 기본 실행 예시

```bash
npm run dev -- ls bots
npm run dev -- view web --port 3000
```

## 로드맵 (TODO)

- [x] 봇 등록/세션 인증/재인증
- [x] YAML 기반 봇/secret 동기화
- [x] 인벤토리 refresh 및 SKU별 재고 조회
- [x] CLI/TUI/Web 조회 경로
- [x] 봇 간 trade offer 생성(수동 승인)
- [x] item price provider 연동
- [ ] 가격 기반 자동 Listing 생성
- [ ] incoming trade 자동 승낙/거절 판단 엔진
- [ ] 거래/리스팅 오케스트레이션 및 작업 추적
- [ ] 운영 대시보드 고도화(상태 모니터링/알림)

## 문서 구조

- 아키텍처 라우팅: `docs/ARCHITECTURE.md`
- 구현/문서 규칙: `docs/RULE.md`
- 모듈 상세: `docs/module/*.md`

README는 프로젝트 성장에 따라 계속 업데이트되는 운영 문서입니다.
