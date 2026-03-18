# Changelog

All notable changes to this project will be documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2025-03-19

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
- `.paginate(opts)` — OFFSET 기반 페이지네이션 (COUNT + DATA 병렬 실행)
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

## [0.0.1] — Initial Release

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
