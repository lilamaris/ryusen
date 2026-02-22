# Prisma Migrations

현재 이 저장소의 마이그레이션 이력은 초기 리팩토링을 거쳐 다음 기준으로 유지됩니다.

- baseline: `20260222160000_initial_schema`
- 목적: 초기 단계에서 분절/중복된 과거 마이그레이션을 하나의 기준선으로 정리

## 사용 규칙

- 로컬 개발에서 **새 마이그레이션 생성**:
  - `npm run prisma:migrate -- --name <feature_name>`
- 저장소에 있는 마이그레이션을 **DB에 적용만**:
  - `npm run prisma:deploy`

## 주의

- baseline 전환 이후에는 기존 로컬 DB가 과거 이력을 갖고 있으면 충돌할 수 있습니다.
- 초기 단계에서는 DB를 재생성한 뒤 baseline부터 적용하는 것을 권장합니다.
