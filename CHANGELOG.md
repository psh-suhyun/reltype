# Changelog

All notable changes to this project will be documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.5] — 2026-03-19

### Changed
- `README.md` — 프로젝트 소개 전면 개편, Prisma/TypeORM/Drizzle 비교표 추가, FAQ 및 사용 시나리오 보강, 대용량/에러처리/풀 설정 가이드 상세화
- `README.ko.md` — 한국어 문서 동일 수준으로 전면 개편 (비교표, FAQ, 운영 가이드 포함)
- `CHANGELOG.md` — 0.1.1 ~ 0.1.4 릴리즈 내역 소급 작성 및 설명 보강

---

## [0.1.4] — 2026-03-19

### Changed
- `package.json` / `package-lock.json` — 버전 범프 (0.1.3 → 0.1.4)

---

## [0.1.3] — 2026-03-19

### Fixed (refactor: type info)

#### Query Guard — 빈 입력 방어 로직 추가
- `buildInsert` — 삽입할 데이터가 없을 때 `logger.error` 출력 후 no-op 반환
- `buildUpdate` — 수정 데이터 없음 / WHERE 조건 없음 각각 감지 후 no-op 반환 (전체 업데이트 방지)
- `buildDelete` — WHERE 조건 없음 감지 후 no-op 반환 (전체 삭제 방지), `RETURNING *` 추가
- `buildUpsert` — 삽입 데이터 없음 감지 후 no-op 반환, 충돌 컬럼만 있을 경우 `DO NOTHING` 처리
- `buildBulkInsert` — 빈 배열 및 첫 row 데이터 없음 감지 후 no-op 반환

#### QueryBuilder — 안정성 개선
- `one()` — `this._limitVal` 직접 변이 제거 → `clone()`으로 원본 불변 처리
- `paginate()` — `Promise.all` 제거, 같은 클라이언트에서 COUNT → DATA 순차 실행
- `cursorPaginate()` — 잘못된 cursor 토큰 시 `logger.error` 출력 후 빈 결과 반환 (cursor 값 메시지 노출 제거)
- `clone()` — `_execHooks` 복사 누락 수정

#### BaseRepo — 일관성 개선
- `exec()` — 빈 SQL 진입 시 `logger.error` 후 즉시 `[]` 반환 (no-op 계층 추가)
- `delete()` — 내부 `withClient` 직접 호출 제거, `exec()` 재사용으로 로깅 일관성 확보
- `selectOne()` — 글로벌 훅(`useHooks`) 자동 적용되도록 수정 (`this.select(where).one()` 위임)
- `findPkKey()` — primary key 미정의 시 조용한 fallback 대신 `logger.warn` 출력

#### Schema / Column
- `Col` — `isDefaultNow: boolean` 필드 추가로 `default()` / `defaultNow()` 의미 구분
- `Col.nullable()` / `notNull()` / `primaryKey()` — `isDefaultNow` 상태 올바르게 전파
- `toSnake()` — 두문자어(Acronym) 처리 개선 (정규식 2단계 적용)
  - `URLParam` → `url_param` ✓ / `userID` → `user_id` ✓

#### Connection Pool
- `PoolStatus` — `isInitialized: boolean` 필드 추가
- `getPoolStatus()` — pool 미초기화 시 `isHealthy: false` 반환 (이전: `true`)
- `readPoolStatus()` — `isHealthy` 조건 개선: `!(waitingCount > 0 && idleCount === 0)` (pool 소진 상태만 unhealthy)

#### Package
- `dotenv` — `dependencies` → `devDependencies` 이동 (라이브러리 소비자 의존성 오염 방지)

---

## [0.1.2] — 2026-03-19

### Changed
- `package.json` / `package-lock.json` — 버전 범프 (0.1.1 → 0.1.2)

---

## [0.1.1] — 2026-03-19

### Added (feat: add schema selection for database connection)
- `defineTable` — PostgreSQL 스키마 지원 추가
  - `defineTable('audit.activity_logs', cols)` — dot 표기법
  - `defineTable('users', cols, { schema: 'auth' })` — 명시적 옵션
  - `qualifiedName` 자동 생성 (`"auth"."users"` 형태로 SQL 식별자 인용)
- `TableOpts` 인터페이스 추가 (`{ schema?: string }`)
- `TableDef` — `qualifiedName` 필드 추가
- `src/index.ts` — `TableOpts` re-export 추가

### Changed
- `package.json` — `pg` → `peerDependencies` 이동, `express` / `nodemon` / `typescript` → `devDependencies` 이동
- `main`, `types`, `exports`, `files`, `keywords`, `repository`, `engines` 필드 추가로 npm 배포 최적화
- `scripts` — `typecheck`, `prepublishOnly` 추가

---

## [0.1.0] — 2026-03-19

### Added

#### Fluent QueryBuilder
- `repo.select(where?)` — 플루언트 쿼리 빌더 시작점. `await` 직접 사용 가능 (thenable)
- `.where(conditions)` — AND 조건 (등호, LIKE, ILIKE, IN, NOT IN, IS NULL 등 연산자 지원)
- `.or(conditions)` — OR 조건 추가
- `.orderBy(clauses)` — ORDER BY (`{ column, direction }` 형태)
- `.limit(n)` / `.offset(n)` — LIMIT / OFFSET
- `.groupBy(cols)` — GROUP BY
- `.join(clause)` — JOIN (INNER / LEFT / RIGHT / FULL)
- `.columns(cols)` — SELECT 컬럼 지정
- `.exec()` — 쿼리 실행 → `T[]`
- `.one()` — 단건 실행 → `T | null`
- `.calculate(fns)` — COUNT / SUM / AVG / MIN / MAX 집계
- `.paginate(opts)` — OFFSET 기반 페이지네이션
- `.toSQL()` — 생성될 SQL 미리 확인 (디버깅용)
- `QueryBuilder.raw(sql, params?)` — 독립 Raw SQL 실행

#### Large Data Processing (대용량 최적화)
- `.cursorPaginate(opts)` — 커서(Keyset) 기반 페이지네이션. OFFSET 없이 일정한 속도 보장
- `.forEach(fn, opts?)` — 배치 처리. 전체 데이터를 메모리에 올리지 않음
- `.stream(opts?)` — AsyncGenerator 스트리밍. `for await...of` 지원
- `[Symbol.asyncIterator]()` — `for await (const row of builder)` 직접 사용 가능
- `.explain(analyze?)` — EXPLAIN (ANALYZE) 쿼리 플랜 분석

#### Hook System (훅 시스템)
- `.hooks({ beforeExec, afterExec, onError })` — 쿼리별 라이프사이클 훅
- `repo.useHooks(h)` — 레포지토리 전역 훅 등록

#### Shorthand Methods
- `repo.selectOne(where)` — `select(where).one()` 단축형
- `repo.raw(sql, params?)` — Raw SQL 단축형

### Changed
- `repo.create`, `repo.update`, `repo.delete`, `repo.upsert`, `repo.bulkCreate` 의 에러 처리를 `DbError` 기반으로 통일
- `Logger` — `text` / `json` 포맷 선택 지원 (`LOG_FORMAT` 환경변수)
- `withClient` — 연결 획득 실패 시 `DbError` 변환 후 로깅
- `runInTx` — 트랜잭션 전 단계에 `DbError` 기반 로깅 적용
- `env.ts` — `dotenv.config()` 제거. 라이브러리는 `process.env`를 읽기만 함

### Fixed
- `Col.nullable()` — `hasDefault` 상태를 올바르게 유지하도록 수정

---

## [0.0.1] — 2026-02-13

### Added
- `defineTable` / `col` — 테이블 스키마 정의 및 타입 추론 (`InferRow`, `InferInsert`, `InferUpdate`)
- `BaseRepo` / `createRepo` — CRUD 레포지토리 (`findAll`, `findById`, `findOne`, `create`, `update`, `delete`, `upsert`, `bulkCreate`)
- `getPool` / `withClient` / `closePool` — 싱글턴 커넥션 풀 관리
- `runInTx` — 트랜잭션 래퍼
- `getPoolStatus` / `checkPoolHealth` — 풀 모니터링
- `toCamel` / `toSnake` / `keysToCamel` / `keysToSnake` / `mapRow` / `mapRows` — 케이스 변환 유틸
- `DbError` — PostgreSQL 에러 분류 (13가지 `DbErrorKind`)
- `Logger` — 레벨 / 포맷 설정 가능한 로거
- `getDatabaseConfig` — 환경 변수 기반 DB 설정 파싱
