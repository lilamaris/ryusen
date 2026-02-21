# Bot Session Module

## Purpose

`bot-session` 모듈은 여러 Steam 봇 계정의 세션 상태를 관리하고, 세션 만료/재인증 시 OTP 기반 인증 흐름을 통해 세션을 갱신합니다.

## Related Modules

- `src/core/bot/bot-session.ts`
  - Bot, BotSession, BotSessionStatus 도메인 타입
- `src/core/port/bot-session-repository.ts`
  - Bot/Session 영속 포트
- `src/core/port/steam-auth-gateway.ts`
  - Steam 인증 포트 (credential + guard-code)
- `src/core/usecase/bot-session-service.ts`
  - bot add/auth/session-check 유스케이스
- `src/adapter/persistence/prisma/prisma-bot-session-repository.ts`
  - Prisma 저장소 구현
- `src/adapter/steam/steam-auth-gateway.ts`
  - `steam-session` 기반 Steam 인증 구현
- `src/index.ts`
  - CLI 엔트리, password/OTP interactive prompt

## Data Model

- `Bot`
  - `name`: 내부 운영 식별자
  - `steamId`: SteamID64
  - `accountName`: Steam 로그인 ID
- `BotSession`
  - `botId`: Bot 1:1 연결
  - `sessionToken`: 세션 토큰
  - `webCookies`: 인증된 Steam web cookie 목록
  - `expiresAt`: 세션 만료 시각
  - `lastCheckedAt`: 마지막 유효성 점검 시각

## Authentication Flow

### `bot add`

1. 사용자에게 Steam password 입력 받음
2. Steam Guard 필요 시 OTP(또는 확인 대기) 입력 받음
3. Steam 인증 성공 시 세션 토큰/만료시각 확보
4. Bot 레코드 생성 또는 기존 Bot 검증
5. BotSession upsert

핵심: 인증이 실패하면 세션이 생성되지 않으며, Bot/세션 불일치 상태를 줄이기 위해 인증 성공 이후에 세션 저장을 수행합니다.

### `bot auth`

1. 기존 Bot을 `name`으로 조회
2. 저장된 `accountName`으로 Steam 재인증
3. 성공 시 BotSession 갱신

### `bot session-check`

- 단일 봇 또는 전체 봇의 세션 유효성을 조회
- 출력: `hasSession`, `isValid`, `expiresAt`, `lastCheckedAt`

## CLI Usage

### 신규 봇 등록 + 즉시 인증

```bash
npm run dev -- bot add --name <bot-name> --steam-id <steam-id64> --account-name <steam-login-id>
```

실행 중 입력:
- `Steam password`
- 필요 시 `Steam Guard code` 또는 모바일 승인 대기

### 기존 봇 재인증

```bash
npm run dev -- bot auth --name <bot-name>
```

### 세션 상태 확인 (단일)

```bash
npm run dev -- bot session-check --name <bot-name>
```

### 세션 상태 확인 (전체)

```bash
npm run dev -- bot session-check
```

## Troubleshooting

- `The table ... does not exist`
  - Prisma 스키마 미반영 상태입니다. `prisma migrate` 또는 `prisma db push`를 먼저 수행하세요.
- `Can't reach database server at localhost:5432`
  - DB 실행 여부와 `DATABASE_URL`을 확인하세요.
- `Bot already exists with different steamId/accountName`
  - 동일 `name`으로 다른 계정 정보를 연결하려는 경우입니다. 기존 Bot 식별자와 입력값을 맞추세요.
