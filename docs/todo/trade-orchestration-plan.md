## 목표

- 기존 `trade` 명령/모듈을 제거하고, 각 봇이 가지고 있는 Steam 세션을 활용해 지정된 `from`→`to` 봇 조합으로 Steam 트레이드 오퍼를 생성하고 추적하는 새로운 흐름을 마련한다.
- 향후 onboarding/secret 관리, auto/manual 상태 전환, CLI 기반 모니터링을 위한 준비 작업을 문서화한다.

## 요구 사항

1. `trade` CLI 그룹과 관련된 도메인(usecase, ports, adapter, docs)을 제거한다.
2. `bots` 사이에서 실제 트레이드 오퍼를 만드는 명령을 추가한다. 최소 `--from`, `--to`, `--sku`, `--amount` 정도의 인풋이 있어야 하며, Steam 트레이드 API(현재 프로젝트 내 Steam auth 클라이언트)로 offer를 생성/보관하는 로직이 필요하다.
3. 트레이드 오퍼 링크, 상태 (`onboarding`, `trade-ready` 등)은 bot 스키마에 추후 추가될 예정이므로, current 단계에서는 offer metadata를 간단히 저장하거나 콘솔에 출력하며 수동 승인 흐름을 지원한다.
4. 나중에 영입/secret 저장 워크플로우를 확장할 수 있도록, CLI 명령 또는 docs에서 설명할 구조(예: `bot sync` 명령, `bots.yaml` + `secrets` 저장소)도 계획에 포함한다.
5. 모듈 구조 및 문서(`docs/module/*`, `docs/ARCHITECTURE.md`)를 새 흐름에 맞게 갱신할 준비를 한다.

## 작업 계획

1. **분석**
   - 현재 `trade` 관련 코드를 전부 파악하여 module/command/test/data 접근 경로를 정리한다.
   - Steam 트레이드 offer 생성/관리에 필요한 서비스 경로를 `core` 및 `adapter`에서 찾는다 (`steam-session` 사용 부분).
2. **설계**
   - `core`에 새로운 `bot-trade-service` usecase 정의(offer 생성, 상태 조회).
   - `adapter`에 Steam API 호출 로직 추가/재사용.
   - `presentation`의 CLI에 `trade` 명령 삭제, 대신 `bot trade` 혹은 `exchange` 명령 추가로 `--from`, `--to`, `--sku`, `--amount` 등 입력을 받아 처리.
   - `docs/module`에 새 module 문서 작성(템플릿 기반). `docs/ARCHITECTURE.md`에는 routing 수정, 기존 `trade` 항목 제거 혹은 대체 설명 추가.
3. **구현**
   - 불필요한 `control-bot-consolidation-service`, `trade-consolidation-settlement-service`, 관련 Prisma 리포지토리/테이블 정리(필요시 schema migration/cleanup 계획).
   - 새 usecase 구현 및 CLI wiring/단위 테스트 추가.
   - Steam offer 관리에 필요한 상태 저장소 추가(단순 JSON 저장소 또는 DB 테이블 고려).
4. **문서화**
   - `docs/module/trade-consolidation.md` 제거 또는 새 module로 대체하고, `docs/ARCHITECTURE.md`에 routing update.
   - `docs/TODO` 계획과 별개로 `docs/module/<new>.md`에 CLI 예시/flow 설명.
   - onboarding/secret 관리 준비 계획을 `docs/todo` 또는 별도 `docs/module/bot-session.md` 설명 영역에 링크.

## 검증 포인트

1. CLI로 명령 실행 시 Steam 트레이드 offer 생성 API 호출 로그/출력이 확인된다.
2. 기존 `trade` 명령/모듈 관련 테스트는 제거 혹은 대체되었고, 새로운 usecase 테스트가 추가된다.
3. 문서(`docs/ARCHITECTURE.md`, 새 module doc)에서 feature 흐름/command 소유권이 정확하게 반영된 상태.

## 리스크/추가 고려

- Steam offer 생성은 secret 없이 수동 승인부터 시작하므로 CLI에 `offer link` 출력 또는 `offer id` 저장 기능이 필요하다.
- DB 스키마 변경(예: trade job/leg 테이블 제거)은 기존 데이터 보호 계획과 migration을 마련해야 한다.
- onboarding/secret 수집 흐름은 향후 구현 예정이므로 현재는 CLI commands/doc 위주로 설명만 두고 추후 확장 가능성을 명시해야 한다.
