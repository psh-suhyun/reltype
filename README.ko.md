# reltype

[![npm version](https://img.shields.io/npm/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![npm downloads](https://img.shields.io/npm/dm/reltype.svg)](https://www.npmjs.com/package/reltype)
[![license](https://img.shields.io/npm/l/reltype.svg)](https://github.com/psh-suhyun/reltype/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

> English documentation → [README.md](./README.md)

**방해받지 않는 PostgreSQL 쿼리 라이브러리.**

Prisma 스키마 파일 없음. 데코레이터 없음. 코드 생성 없음. 마이그레이션 CLI 없음.  
TypeScript만 있으면 됩니다 — 테이블을 한 번 정의하면 완전히 타입이 지정된 쿼리를 즉시 사용할 수 있습니다.

```ts
// 한 번 정의하면
const usersTable = defineTable('users', {
  id:        col.serial().primaryKey(),
  firstName: col.varchar(255).notNull(),
  email:     col.text().notNull(),
  isActive:  col.boolean().default(),
  createdAt: col.timestamptz().defaultNow(),
});

// 어디서든 완전한 타입으로 사용
const page = await userRepo
  .select({ isActive: true })
  .where({ email: { operator: 'ILIKE', value: '%@gmail.com' } })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .paginate({ page: 1, pageSize: 20 });
// → { data: User[], count: 150, page: 1, pageSize: 20, nextAction: true, previousAction: false }
```

---

## 왜 reltype인가?

### 기존 도구들의 문제점

| | Prisma | TypeORM | Drizzle | **reltype** |
|---|---|---|---|---|
| 스키마 정의 | `schema.prisma` 파일 | 클래스 데코레이터 | TS 스키마 | **TS 스키마** |
| 코드 생성 필요 | ✅ 필요 | ❌ 불필요 | ❌ 불필요 | **❌ 불필요** |
| 마이그레이션 CLI 필요 | ✅ 필요 | 선택 | 선택 | **❌ 영원히 불필요** |
| camelCase ↔ snake_case | 수동 설정 | 수동 설정 | 수동 설정 | **자동** |
| Raw SQL 지원 | 제한적 | 있음 | 있음 | **있음** |
| 번들 크기 | 무거움 | 무거움 | 가벼움 | **최소** |
| 대용량 스트리밍 | 플러그인 필요 | 직접 구현 | 직접 구현 | **내장** |

### reltype이 다른 이유

**1. 한 번 정의하면 타입이 자동으로 생성됩니다**  
TypeScript로 스키마를 작성하세요. `INSERT`, `SELECT`, `UPDATE` 타입이 자동으로 추론됩니다.  
중복된 인터페이스, `@Entity`, `model User {}`가 필요 없습니다.

**2. camelCase ↔ snake_case 변환이 완전 자동입니다**  
DB에는 `first_name`, `created_at`, `is_active`가 있고 TypeScript에는 `firstName`, `createdAt`, `isActive`가 있습니다.  
reltype이 양방향 매핑을 항상, 무료로 처리합니다.

**3. 빌드 과정, CLI, 마이그레이션 파일이 없습니다**  
`npm install reltype` 하고 쿼리를 작성하기 시작하면 됩니다. 그게 전부입니다.

**4. 대규모 프로덕션에서도 바로 사용 가능합니다**  
커서 기반 페이지네이션, AsyncGenerator 스트리밍, 배치 처리, 커넥션 풀 모니터링, 구조화된 에러 분류, 라이프사이클 훅 — 모두 내장되어 있습니다.

---

## 설치

```bash
npm install reltype pg
npm install --save-dev @types/pg
```

> `pg` (node-postgres)는 peerDependency입니다. 8.0.0 이상 필요합니다.

---

## 2분 빠른 시작

### 1단계 — 환경 변수 설정

```env
# .env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres
DB_MAX=10
DB_CONNECTION_TIMEOUT=3000
```

또는 연결 문자열 사용:

```env
DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/mydb
```

### 2단계 — 앱 진입점에서 dotenv 로드

```ts
// index.ts — 가장 첫 번째 줄이어야 합니다
import 'dotenv/config';

import { getPool } from 'reltype';
```

### 3단계 — 테이블 스키마 정의

```ts
// schema/usersTable.ts
import { defineTable, col } from 'reltype';

export const usersTable = defineTable('users', {
  id:        col.serial().primaryKey(),
  firstName: col.varchar(255).notNull(),
  lastName:  col.varchar(255).nullable(),
  email:     col.text().notNull(),
  isActive:  col.boolean().default(),
  createdAt: col.timestamptz().defaultNow(),
});

// 타입은 자동으로 사용 가능 — 추가 코드 불필요
// InferRow<typeof usersTable>    → SELECT 결과 타입
// InferInsert<typeof usersTable> → INSERT 입력 타입 (수정자에 따라 필수/선택)
// InferUpdate<typeof usersTable> → UPDATE 입력 타입 (PK 제외, 모두 선택)
```

### 4단계 — 레포지토리 생성 및 쿼리

```ts
import { createRepo } from 'reltype';
import { usersTable } from './schema/usersTable';

export const userRepo = createRepo(usersTable);

// SELECT
const users = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .limit(10);

// INSERT
const user = await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });

// UPDATE
const updated = await userRepo.update(user.id, { isActive: false });

// DELETE
const deleted = await userRepo.delete(user.id);
```

완료. 이제 완전히 타입이 지정된 프로덕션 수준의 데이터 레이어가 생겼습니다.

---

## 타입 추론 — 핵심 기능

스키마를 한 번 정의하면 reltype이 모든 타입을 자동으로 추론합니다:

```ts
import { InferRow, InferInsert, InferUpdate } from 'reltype';

type User = InferRow<typeof usersTable>;
// {
//   id: number;
//   firstName: string;
//   lastName: string | null;
//   email: string;
//   isActive: boolean;
//   createdAt: Date;
// }

type CreateUser = InferInsert<typeof usersTable>;
// {
//   firstName: string;         ← 필수 (notNull, 기본값 없음)
//   email: string;             ← 필수
//   lastName?: string | null;  ← 선택 (nullable)
//   isActive?: boolean;        ← 선택 (DB 기본값 있음)
//   createdAt?: Date;          ← 선택 (defaultNow)
// }
// id 제외 — serial이 자동 생성

type UpdateUser = InferUpdate<typeof usersTable>;
// {
//   firstName?: string;
//   lastName?: string | null;
//   email?: string;
//   isActive?: boolean;
//   createdAt?: Date;
// }
// id 제외 — 조회 키로만 사용
```

스키마에서 컬럼을 변경하면 TypeScript가 즉시 잘못된 모든 호출 위치를 감지합니다.  
**스키마가 유일한 진실의 원천입니다.**

---

## 레포지토리 API

| 메서드 | 반환 타입 | 설명 |
|---|---|---|
| `create(data)` | `Promise<T>` | 단일 행 INSERT |
| `update(id, data)` | `Promise<T \| null>` | primary key로 UPDATE |
| `delete(id)` | `Promise<boolean>` | primary key로 DELETE |
| `upsert(data, col?)` | `Promise<T>` | 충돌 시 INSERT 또는 UPDATE |
| `bulkCreate(rows)` | `Promise<T[]>` | 단일 쿼리로 여러 행 INSERT |
| `select(where?)` | `QueryBuilder<T>` | 플루언트 쿼리 시작 |
| `selectOne(where)` | `Promise<T \| null>` | 단일 행 조회 |
| `raw(sql, params?)` | `Promise<R[]>` | Raw SQL 실행 |
| `findAll(opts?)` | `Promise<T[]>` | 필터/정렬/페이징을 포함한 간단한 쿼리 |
| `findById(id)` | `Promise<T \| null>` | primary key로 단일 행 조회 |
| `findOne(where)` | `Promise<T \| null>` | 조건으로 단일 행 조회 |
| `useHooks(h)` | `this` | 전역 라이프사이클 훅 등록 |

---

## 플루언트 쿼리 빌더

`repo.select(where?)`는 `QueryBuilder`를 반환합니다.  
메서드를 자유롭게 체이닝한 후 `await`하거나 `.exec()`를 호출하면 실행됩니다.

### 필터링 (WHERE / OR)

```ts
// 단순 동등 비교
const users = await userRepo.select({ isActive: true });

// 연산자: =, !=, >, <, >=, <=, LIKE, ILIKE, IN, NOT IN, IS NULL, IS NOT NULL
const users = await userRepo.select()
  .where({ createdAt: { operator: '>=', value: new Date('2024-01-01') } })
  .where({ id:        { operator: 'IN', value: [1, 2, 3] }             });

// OR 조건
const users = await userRepo.select({ isActive: true })
  .or({ firstName: { operator: 'ILIKE', value: '%john%' } })
  .or({ email:     { operator: 'ILIKE', value: '%john%' } });
// → WHERE (is_active = true) OR (first_name ILIKE '%john%') OR (email ILIKE '%john%')

// NULL 확인
const unverified = await userRepo.select()
  .where({ verifiedAt: { operator: 'IS NULL' } });
```

### 정렬, 페이징, 그룹화

```ts
const users = await userRepo.select()
  .orderBy([
    { column: 'isActive',  direction: 'DESC' },
    { column: 'createdAt', direction: 'ASC'  },
  ])
  .limit(20)
  .offset(40);  // 3페이지

// GROUP BY + 집계
const stats = await userRepo.select()
  .groupBy(['isActive'])
  .calculate([{ fn: 'COUNT', alias: 'count' }]);
```

### JOIN

```ts
const result = await userRepo.select({ isActive: true })
  .join({ table: 'orders', on: 'users.id = orders.user_id', type: 'LEFT' })
  .columns(['users.id', 'users.email', 'COUNT(orders.id) AS orderCount'])
  .groupBy(['users.id', 'users.email'])
  .exec();
```

> JOIN 타입: `INNER` · `LEFT` · `RIGHT` · `FULL`

### 디버깅 — 실행 전 SQL 미리 보기

```ts
const { sql, params } = userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .limit(20)
  .toSQL();

console.log(sql);
// SELECT * FROM users WHERE is_active = $1 ORDER BY created_at DESC LIMIT $2
console.log(params);
// [ true, 20 ]
```

---

## 페이지네이션

### OFFSET 페이지네이션 — 일반적인 목록 화면

```ts
const result = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .paginate({ page: 1, pageSize: 20 });

// {
//   data:           User[],
//   count:          150,     ← 전체 매칭 행 수 (COUNT 쿼리 자동 실행)
//   page:           1,
//   pageSize:       20,
//   nextAction:     true,    ← 다음 페이지 존재
//   previousAction: false,   ← 이전 페이지 없음
// }
```

### 커서 페이지네이션 — 대용량 테이블

OFFSET은 페이지가 깊어질수록 느려집니다. 커서 페이지네이션은 그렇지 않습니다.  
`WHERE id > last_id` 방식은 아무리 깊은 페이지도 동일한 속도를 보장합니다.

```ts
// 1페이지
const p1 = await userRepo.select({ isActive: true })
  .cursorPaginate({ pageSize: 20, cursorColumn: 'id' });
// → { data: [...], nextCursor: 'eyJpZCI6MjB9', pageSize: 20, hasNext: true }

// 2페이지 — 커서를 전달
const p2 = await userRepo.select({ isActive: true })
  .cursorPaginate({ pageSize: 20, cursorColumn: 'id', cursor: p1.nextCursor });

// 내림차순 (최신순)
const latest = await userRepo.select()
  .cursorPaginate({ pageSize: 20, cursorColumn: 'createdAt', direction: 'desc' });
```

| | `paginate` | `cursorPaginate` |
|---|---|---|
| 전체 개수 제공 | ✅ 있음 | ❌ 없음 |
| 페이지 번호 이동 | ✅ 있음 | ❌ 다음/이전만 |
| 100만 번째 행에서 성능 | ❌ 느림 | ✅ 일정한 속도 |
| 적합한 상황 | 관리자 테이블, 일반 목록 | 피드, 로그, 대용량 내보내기 |

---

## 대용량 데이터 처리

### 배치 처리 (forEach)

서버를 다운시키지 않고 1,000만 건을 처리합니다. 청크 단위로 처리하며 전체를 메모리에 올리지 않습니다.

```ts
// 모든 활성 사용자에게 이메일 전송 — 전체 사용자를 한 번에 로드하지 않음
await userRepo.select({ isActive: true })
  .orderBy([{ column: 'id', direction: 'ASC' }])
  .forEach(async (batch) => {
    await sendEmailBatch(batch);  // batch: User[] (한 번에 200행)
  }, { batchSize: 200 });
```

### 스트리밍 (AsyncGenerator)

`for await...of`로 행을 하나씩 처리합니다. 실시간 파이프라인에 완벽합니다.

```ts
for await (const user of userRepo.select({ isActive: true })) {
  await processRow(user);  // 한 번에 한 행, 낮은 메모리 사용
}

// 내부 페칭의 배치 크기 커스텀
for await (const user of userRepo.select().stream({ batchSize: 1000 })) {
  await writeToFile(user);
}
```

### EXPLAIN — 쿼리 플랜 분석

```ts
// 인덱스가 사용되는지 확인
const plan = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .explain(true);  // true = EXPLAIN ANALYZE (실제로 실행)

console.log(plan);
// Index Scan using users_created_at_idx on users ...
```

---

## 집계 함수

```ts
// 단일 집계
const result = await userRepo.select().calculate([{ fn: 'COUNT', alias: 'count' }]);
const total = parseInt(String(result.count), 10);  // → 1042

// 필터를 포함한 복수 집계
const stats = await userRepo.select({ isActive: true })
  .calculate([
    { fn: 'COUNT', alias: 'total'    },
    { fn: 'AVG',   column: 'score', alias: 'avgScore' },
    { fn: 'MAX',   column: 'score', alias: 'maxScore' },
  ]);
// → { total: '850', avgScore: '72.4', maxScore: '100' }
```

---

## Raw SQL

쿼리 빌더로 부족할 때 Raw SQL을 직접 사용하세요. camelCase 변환은 그대로 적용됩니다.

```ts
// 레포지토리를 통해
const users = await userRepo.raw<{ id: number; orderCount: number }>(
  `SELECT u.id, COUNT(o.id) AS order_count
   FROM users u
   LEFT JOIN orders o ON u.id = o.user_id
   WHERE u.is_active = $1
   GROUP BY u.id`,
  [true],
);
// → [{ id: 1, orderCount: 5 }, ...]  ← order_count → orderCount 자동 변환

// 독립 실행 (레포지토리 불필요)
import { QueryBuilder } from 'reltype';

const rows = await QueryBuilder.raw(
  'SELECT * FROM users WHERE first_name ILIKE $1',
  ['%john%'],
);
```

---

## CRUD 메서드

### create

```ts
const user = await userRepo.create({
  firstName: 'Alice',
  email:     'alice@example.com',
  // isActive, createdAt → 선택 (DB가 기본값 처리)
});
// → User (RETURNING *로 전체 행 반환)
```

### update

```ts
// 전달한 필드만 업데이트
const updated = await userRepo.update(1, {
  firstName: 'Alicia',
  isActive:  true,
});
// → User | null (ID 없으면 null)
```

### delete

```ts
const ok = await userRepo.delete(1);
// → 삭제되면 true, 없으면 false
```

### upsert

```ts
// primary key 충돌 (기본)
await userRepo.upsert({ id: 1, firstName: 'Bob', email: 'bob@example.com' });

// 다른 unique 컬럼 충돌
await userRepo.upsert(
  { firstName: 'Bob', email: 'bob@example.com' },
  'email',  // snake_case 컬럼명
);
```

### bulkCreate

```ts
const users = await userRepo.bulkCreate([
  { firstName: 'Alice', email: 'alice@example.com' },
  { firstName: 'Bob',   email: 'bob@example.com'   },
  { firstName: 'Carol', email: 'carol@example.com' },
]);
// → User[]  (단일 INSERT 쿼리, RETURNING *)
```

---

## 라이프사이클 훅

비즈니스 로직을 건드리지 않고 모든 쿼리를 모니터링하거나 APM을 통합하거나 느린 쿼리를 로깅할 수 있습니다.

### 쿼리별 훅

```ts
const users = await userRepo.select({ isActive: true })
  .hooks({
    beforeExec: ({ sql, params }) => {
      console.log('[SQL]', sql);
    },
    afterExec: ({ rows, elapsed }) => {
      if (elapsed > 500) console.warn('느린 쿼리:', elapsed, 'ms');
      metrics.record('db.query.duration', elapsed);
    },
    onError: ({ err, sql }) => {
      alerting.send({ message: err.message, sql });
    },
  })
  .paginate({ page: 1, pageSize: 20 });
```

### 레포지토리 전역 훅

한 번 설정하면 이 레포지토리의 모든 `select()`에 자동으로 적용됩니다.

```ts
userRepo.useHooks({
  beforeExec: ({ sql }) => logger.debug('SQL:', sql),
  afterExec:  ({ elapsed }) => metrics.histogram('db.latency', elapsed),
  onError:    ({ err })   => logger.error('DB 오류', { kind: err.kind }),
});
```

---

## 에러 처리

### DbError — 구조화된 PostgreSQL 에러 분류

모든 DB 에러는 자동으로 `DbError`로 래핑됩니다.  
사용자에게 안전하게 보여줄 정보와 로그에만 남길 내부 정보를 분리합니다.

```ts
import { DbError } from 'reltype';

try {
  await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });
} catch (err) {
  if (err instanceof DbError) {
    // ✅ 클라이언트에 안전하게 전달 가능
    res.status(409).json(err.toUserPayload());
    // → { error: '이미 존재하는 값입니다.', kind: 'uniqueViolation', isRetryable: false }

    // 🔒 내부 상세 정보 — 절대 외부에 노출하지 마세요
    logger.error('db 오류', err.toLogContext());
    // → { pgCode: '23505', table: 'users', constraint: 'users_email_key', detail: '...' }

    // 일시적 오류 재시도
    if (err.isRetryable) await retry(operation);
  }
}
```

### Express 통합 예제

```ts
app.post('/users', async (req, res) => {
  try {
    const user = await userRepo.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof DbError) {
      const status =
        err.kind === 'uniqueViolation'    ? 409 :
        err.kind === 'notNullViolation'   ? 400 :
        err.kind === 'foreignKeyViolation'? 422 :
        err.isRetryable                   ? 503 : 500;
      res.status(status).json(err.toUserPayload());
    } else {
      res.status(500).json({ error: '예기치 못한 오류가 발생했습니다.' });
    }
  }
});
```

### 에러 종류 참조

| Kind | PostgreSQL 코드 | 설명 | isRetryable |
|---|---|---|---|
| `uniqueViolation` | 23505 | UNIQUE 제약 위반 | false |
| `foreignKeyViolation` | 23503 | FK 제약 위반 | false |
| `notNullViolation` | 23502 | NOT NULL 제약 위반 | false |
| `checkViolation` | 23514 | CHECK 제약 위반 | false |
| `deadlock` | 40P01 | 교착 상태 | **true** |
| `serializationFailure` | 40001 | 직렬화 실패 | **true** |
| `connectionFailed` | 08xxx | 연결 실패 | **true** |
| `tooManyConnections` | 53300 | 풀 소진 | **true** |
| `queryTimeout` | 57014 | 쿼리 시간 초과 | false |
| `undefinedTable` | 42P01 | 테이블 없음 | false |
| `undefinedColumn` | 42703 | 컬럼 없음 | false |
| `invalidInput` | 22xxx | 잘못된 데이터 형식 | false |
| `unknown` | 기타 | 분류되지 않은 오류 | false |

---

## 트랜잭션

```ts
import { runInTx } from 'reltype';

await runInTx(async (client) => {
  // 두 작업이 같은 트랜잭션에서 실행됨
  const user  = await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });
  const order = await orderRepo.create({ userId: user.id, total: 9900 });
  return { user, order };
});
// 어떤 작업이든 실패하면 자동으로 ROLLBACK
```

---

## 커넥션 풀

```ts
import { getPool, getPoolStatus, checkPoolHealth, closePool } from 'reltype';

// 실시간 풀 지표
const status = getPoolStatus();
// {
//   isInitialized: true,
//   totalCount:    8,   ← 총 오픈된 연결 수
//   idleCount:     3,   ← 사용 가능한 연결 수
//   waitingCount:  0,   ← 대기 중인 요청 (0 = 정상)
//   isHealthy:     true
// }

// DB 서버 핑 (SELECT 1)
const alive = await checkPoolHealth();  // → boolean

// 안전한 종료
process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
```

### 권장 풀 설정

```env
DB_MAX=10                  # 최대 연결 수 (Postgres max_connections에 맞게 설정)
DB_CONNECTION_TIMEOUT=3000 # ⚠️  필수 설정 — 없으면 풀 소진 시 무한 대기
DB_IDLE_TIMEOUT=30000      # 30초 후 유휴 연결 해제
DB_STATEMENT_TIMEOUT=10000 # 10초 후 폭주 쿼리 강제 종료
```

> `DB_CONNECTION_TIMEOUT`을 설정하지 않으면 reltype이 시작 시 경고를 출력합니다.  
> 이 값 없이 풀이 소진되면 요청이 무한정 대기하게 됩니다.

---

## PostgreSQL 스키마 지원

```ts
// 점 표기법
const logsTable = defineTable('audit.activity_logs', { ... });

// 명시적 옵션
const usersTable = defineTable('users', { ... }, { schema: 'auth' });

// → SQL: INSERT INTO "auth"."users" ...
// 예약어 충돌을 피하기 위해 식별자는 항상 인용됩니다
```

---

## 컬럼 타입

| 메서드 | PostgreSQL 타입 | TypeScript 타입 |
|---|---|---|
| `col.serial()` | `SERIAL` | `number` |
| `col.integer()` | `INTEGER` | `number` |
| `col.bigint()` | `BIGINT` | `bigint` |
| `col.numeric()` | `NUMERIC` | `number` |
| `col.varchar(n?)` | `VARCHAR(n)` | `string` |
| `col.text()` | `TEXT` | `string` |
| `col.boolean()` | `BOOLEAN` | `boolean` |
| `col.timestamp()` | `TIMESTAMP` | `Date` |
| `col.timestamptz()` | `TIMESTAMPTZ` | `Date` |
| `col.date()` | `DATE` | `Date` |
| `col.uuid()` | `UUID` | `string` |
| `col.jsonb<T>()` | `JSONB` | `T` (기본 `unknown`) |

### 수정자

```ts
col.text().notNull()           // INSERT 필수
col.text().nullable()          // INSERT 선택, NULL 허용
col.integer().primaryKey()     // INSERT 선택, serial/자동
col.boolean().default()        // INSERT 선택 (DB에 DEFAULT 있음)
col.timestamptz().defaultNow() // INSERT 선택 (DEFAULT NOW())
```

---

## BaseRepo 확장

레포지토리에 도메인 전용 메서드를 추가하세요:

```ts
import { BaseRepo, InferRow } from 'reltype';
import { usersTable } from './schema';

class UserRepo extends BaseRepo<typeof usersTable> {
  findActive(): Promise<InferRow<typeof usersTable>[]> {
    return this.findAll({ where: { isActive: true } });
  }

  findByEmail(email: string): Promise<InferRow<typeof usersTable> | null> {
    return this.findOne({ email });
  }

  async search(query: string, page: number) {
    return this.select()
      .or({ firstName: { operator: 'ILIKE', value: `%${query}%` } })
      .or({ email:     { operator: 'ILIKE', value: `%${query}%` } })
      .orderBy([{ column: 'createdAt', direction: 'DESC' }])
      .paginate({ page, pageSize: 20 });
  }
}

export const userRepo = new UserRepo(usersTable);
```

---

## 로깅

```env
LOGGER=true          # 로깅 활성화
LOG_LEVEL=debug      # debug | info | log | warn | error
LOG_FORMAT=json      # text (개발, 색상) | json (프로덕션, 로그 수집기)
```

**개발 환경 출력 (`text` 포맷):**
```
2026-01-01T00:00:00.000Z [Pool] INFO  풀 생성 완료 { max: 10, connectionTimeoutMillis: 3000 }
2026-01-01T00:00:00.000Z [Repo] DEBUG SQL: SELECT * FROM users WHERE is_active = $1 [ true ]
2026-01-01T00:00:00.000Z [Repo] DEBUG 완료 (8ms) rowCount=42
```

**프로덕션 출력 (`json` 포맷, Datadog / CloudWatch / Grafana Loki용):**
```json
{"ts":"2026-01-01T00:00:00.000Z","level":"INFO","prefix":"[Pool]","msg":"풀 생성 완료","meta":[{"max":10}]}
{"ts":"2026-01-01T00:00:00.000Z","level":"ERROR","prefix":"[Repo]","msg":"쿼리 실패 [users]","meta":[{"pgCode":"23505","kind":"uniqueViolation","constraint":"users_email_key"}]}
```

| 레벨 | 접두사 | 이벤트 |
|---|---|---|
| INFO | [Pool] | 풀 생성 / 종료 |
| WARN | [Pool] | connectionTimeoutMillis 미설정 / 최대 연결 수 도달 |
| ERROR | [Pool] | 유휴 클라이언트 오류 / 연결 획득 실패 |
| DEBUG | [Repo] | 모든 SQL + 경과 시간 |
| ERROR | [Repo] | 쿼리 실패 (pgCode, kind, elapsed 포함) |
| DEBUG | [Tx] | 트랜잭션 시작 / 커밋 |
| WARN | [Tx] | 롤백 |
| ERROR | [Tx] | 롤백 실패 |

---

## 전체 환경 변수

```env
# ── 연결 ──────────────────────────────────────────────────────────────────────
DB_CONNECTION_STRING=             # postgresql://user:pass@host:5432/db (우선)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres

# ── 풀 ────────────────────────────────────────────────────────────────────────
DB_MAX=10                         # 최대 풀 크기
DB_IDLE_TIMEOUT=30000             # 유휴 연결 해제 (ms)
DB_CONNECTION_TIMEOUT=3000        # 연결 획득 최대 대기 (ms) — 반드시 설정하세요
DB_ALLOW_EXIT_ON_IDLE=false       # 풀이 비었을 때 프로세스 종료 허용
DB_STATEMENT_TIMEOUT=0            # 최대 구문 실행 시간 (ms, 0 = 무제한)
DB_QUERY_TIMEOUT=0                # 최대 쿼리 시간 (ms, 0 = 무제한)
DB_SSL=false                      # SSL 활성화
DB_KEEP_ALIVE=true                # TCP 연결 유지
DB_KEEP_ALIVE_INITIAL_DELAY=10000 # 연결 유지 초기 지연 (ms)
DB_APPLICATION_NAME=my-app        # pg_stat_activity에 표시될 앱 이름

# ── 로깅 ──────────────────────────────────────────────────────────────────────
LOGGER=true
LOG_LEVEL=info                    # debug | info | log | warn | error
LOG_FORMAT=text                   # text | json
```

---

## 자주 묻는 질문 (FAQ)

**Q. 마이그레이션을 실행해야 하나요?**  
아니요. reltype은 데이터베이스 스키마를 관리하지 않습니다. 선호하는 마이그레이션 도구(Flyway, Liquibase, `psql` 등)를 사용하세요. reltype은 SQL 쿼리만 생성하고 실행합니다.

**Q. 기존 데이터베이스와 함께 사용할 수 있나요?**  
네. 기존 컬럼과 일치하도록 `defineTable(...)`을 정의하기만 하면 됩니다. reltype은 Postgres에 있는 데이터를 읽기만 합니다.

**Q. 매우 복잡한 쿼리는 어떻게 하나요?**  
`repo.raw(sql, params)` 또는 `QueryBuilder.raw(sql, params)`를 사용하여 완전한 SQL 제어권을 가지세요. 결과에 camelCase 변환은 여전히 적용됩니다.

**Q. NestJS / Fastify / Koa와 함께 사용할 수 있나요?**  
네. reltype은 프레임워크에 종속되지 않습니다. `pg`에만 의존합니다.

**Q. SQL 인젝션에 안전한가요?**  
`where`, `create`, `update` 등의 모든 값은 파라미터화된 쿼리(`$1`, `$2`, ...)로 전달됩니다. 문자열 보간을 사용하지 않습니다. 주의해야 할 유일한 부분은 `.join()`의 `on` 절입니다 — 코드에서 정적 문자열로 구성하세요.

**Q. Drizzle ORM과 어떻게 다른가요?**  
둘 다 TypeScript 우선이며 가볍습니다. reltype의 주요 장점은 자동 camelCase↔snake_case 변환(Drizzle은 수동 컬럼 이름 지정 필요), 커서 페이지네이션, 스트리밍, 배치 처리의 내장 지원, 그리고 사용자 안전 메시지를 포함한 구조화된 `DbError` 시스템입니다.

---

## 아키텍처

```
reltype/
├── index.ts                        ← 공개 API
├── configs/env.ts                  ← DB 설정 헬퍼
├── utils/
│   ├── logger.ts                   ← Logger (text/json 포맷)
│   ├── dbError.ts                  ← DbError 분류
│   └── reader.ts                   ← 환경 파서, PostgresConfig
└── features/
    ├── schema/                     ← defineTable, col, InferRow/Insert/Update
    ├── transform/                  ← camelCase ↔ snake_case
    ├── connection/                 ← Pool, withClient, runInTx
    ├── query/                      ← QueryBuilder, build* 함수들
    └── repository/                 ← BaseRepo, createRepo
```

---

## 기여하기

버그 리포트, 기능 제안, PR을 모두 환영합니다.

→ [이슈 열기](https://github.com/psh-suhyun/reltype/issues)  
→ [PR 제출](https://github.com/psh-suhyun/reltype/pulls)

---

## 변경 이력

전체 버전 히스토리는 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.

---

## 라이선스

MIT © [psh-suhyun](https://github.com/psh-suhyun)
