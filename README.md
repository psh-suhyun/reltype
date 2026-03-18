# reltype

[![npm version](https://img.shields.io/npm/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![npm downloads](https://img.shields.io/npm/dm/reltype.svg)](https://www.npmjs.com/package/reltype)
[![license](https://img.shields.io/npm/l/reltype.svg)](https://github.com/psh-suhyun/reltype/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

**Type-first relational modeling for PostgreSQL in TypeScript.**

PostgreSQL 테이블을 TypeScript 코드로 정의하면, 모든 쿼리의 반환 타입이 자동으로 추론됩니다.

- **타입 안전** — 스키마 정의에서 INSERT / SELECT / UPDATE 타입을 자동 추론
- **camelCase ↔ snake_case** — DB 컬럼과 TypeScript 변수명을 자동 변환
- **플루언트 쿼리 빌더** — `WHERE`, `OR`, `JOIN`, `GROUP BY`, `LIMIT`, `paginate`, `calculate`, `stream` 체인 지원
- **대용량 최적화** — 커서 페이지네이션, 배치 처리, AsyncGenerator 스트리밍
- **에러 분류** — `DbError`로 PostgreSQL 에러를 13가지 종류로 자동 분류
- **훅 시스템** — 쿼리 전/후 라이프사이클 훅으로 모니터링·APM 연동

---

## Installation

```bash
# reltype 설치
npm install reltype

# pg는 peerDependency — 직접 설치해야 합니다
npm install pg
npm install --save-dev @types/pg
```

> `pg` 버전 8.0.0 이상이 필요합니다.

---

## Environment Variables

`.env` 파일을 프로젝트 루트에 생성합니다.

```env
# ── 필수 (CONNECTION_STRING 또는 DB_NAME 중 하나는 반드시 설정) ──────────────

# 방법 1: Connection String (우선 적용)
DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/mydb

# 방법 2: 개별 설정
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres

# ── 선택 ────────────────────────────────────────────────────────────────────

DB_SSL=false                      # SSL 활성화 여부
DB_MAX=10                         # 최대 연결 풀 수
DB_IDLE_TIMEOUT=30000             # idle 연결 해제 대기시간 (ms)
DB_CONNECTION_TIMEOUT=2000        # 연결 타임아웃 (ms)
DB_ALLOW_EXIT_ON_IDLE=false       # idle 상태에서 프로세스 종료 허용
DB_STATEMENT_TIMEOUT=0            # SQL 문 실행 타임아웃 (ms, 0=무제한)
DB_QUERY_TIMEOUT=0                # 쿼리 타임아웃 (ms, 0=무제한)
DB_APPLICATION_NAME=my-app        # pg_stat_activity에 표시될 앱 이름
DB_KEEP_ALIVE=true                # TCP keep-alive 활성화
DB_KEEP_ALIVE_INITIAL_DELAY=10000 # keep-alive 최초 지연 (ms)

# ── 로깅 ────────────────────────────────────────────────────────────────────

LOGGER=true                       # 로거 활성화 (true / false)
LOG_LEVEL=info                    # 로그 레벨 (debug / info / log / warn / error)
```

---

## Quick Start

### 1. 테이블 스키마 정의

```ts
import { defineTable, col } from 'reltype';

export const usersTable = defineTable('users', {
  id:        col.serial().primaryKey(),       // SERIAL PRIMARY KEY (INSERT 시 optional)
  firstName: col.varchar(255).notNull(),      // VARCHAR(255) NOT NULL
  lastName:  col.varchar(255).nullable(),     // VARCHAR(255) NULL (INSERT 시 optional)
  email:     col.text().notNull(),            // TEXT NOT NULL
  isActive:  col.boolean().default(),         // BOOLEAN DEFAULT ... (INSERT 시 optional)
  createdAt: col.timestamptz().defaultNow(),  // TIMESTAMPTZ DEFAULT NOW() (INSERT 시 optional)
});
```

### 2. 타입 자동 추론

```ts
import { InferRow, InferInsert, InferUpdate } from 'reltype';

// SELECT 결과 타입
type User = InferRow<typeof usersTable>;
// {
//   id: number;
//   firstName: string;
//   lastName: string | null;
//   email: string;
//   isActive: boolean;
//   createdAt: Date;
// }

// INSERT 입력 타입 (optional 컬럼 자동 제외)
type CreateUser = InferInsert<typeof usersTable>;
// { firstName: string; email: string; lastName?: string | null; isActive?: boolean; createdAt?: Date }

// UPDATE 입력 타입 (PK 제외, 전체 optional)
type UpdateUser = InferUpdate<typeof usersTable>;
// { firstName?: string; lastName?: string | null; email?: string; isActive?: boolean; createdAt?: Date }
```

### 3. 앱 진입점에서 dotenv 로드

`reltype`은 `process.env`를 읽기만 합니다. `.env` 파일 로딩은 **애플리케이션 진입점**에서 직접 하세요.

```ts
// 애플리케이션 진입점 (index.ts / server.ts / app.ts)
import 'dotenv/config';  // 반드시 다른 import 전에 위치

// 이후 reltype import
import { getDatabaseConfig, getPool } from 'reltype';
```

### 4. Repository 생성

```ts
import { createRepo } from 'reltype';
import { usersTable } from './schema';

export const userRepo = createRepo(usersTable);
```

---

## Repository API

### 전체 메서드 요약

| 메서드 | 반환 타입 | 설명 |
|---|---|---|
| `create(data)` | `Promise<T>` | 단건 INSERT |
| `update(id, data)` | `Promise<T \| null>` | PK 기준 UPDATE |
| `delete(id)` | `Promise<boolean>` | PK 기준 DELETE |
| `upsert(data, col?)` | `Promise<T>` | INSERT or UPDATE |
| `bulkCreate(rows)` | `Promise<T[]>` | 다건 INSERT |
| `select(where?)` | `QueryBuilder<T>` | 플루언트 빌더 시작점 |
| `selectOne(where)` | `Promise<T \| null>` | 단건 조회 |
| `raw(sql, params?)` | `Promise<R[]>` | Raw SQL 실행 |
| `findAll(opts?)` | `Promise<T[]>` | 정적 전체 조회 |
| `findById(id)` | `Promise<T \| null>` | PK 단건 조회 |
| `findOne(where)` | `Promise<T \| null>` | 조건 단건 조회 |
| `useHooks(h)` | `this` | 글로벌 훅 등록 |

---

## create

단건 INSERT. 자동으로 생성되는 컬럼(serial, default, nullable)은 입력을 생략할 수 있습니다.

```ts
const user = await userRepo.create({
  firstName: 'John',
  email:     'john@example.com',
  // lastName, isActive, createdAt → optional (DB default 또는 nullable)
});
// → User
```

---

## update

PK를 기준으로 지정한 컬럼만 UPDATE합니다. 존재하지 않으면 `null`을 반환합니다.

```ts
// 부분 업데이트
const updated = await userRepo.update(1, {
  firstName: 'Jane',
  isActive:  false,
});
// → User | null

if (!updated) {
  throw new Error('사용자를 찾을 수 없습니다.');
}
```

---

## delete

PK를 기준으로 삭제합니다. 삭제된 row가 있으면 `true`, 없으면 `false`를 반환합니다.

```ts
const deleted = await userRepo.delete(1);
// → boolean

if (!deleted) {
  throw new Error('사용자를 찾을 수 없습니다.');
}
```

---

## upsert

충돌 컬럼 기준으로 INSERT 또는 UPDATE합니다.

```ts
// PK(id) 기준 (기본값)
const user = await userRepo.upsert({
  id:        1,
  firstName: 'John',
  email:     'john@example.com',
});

// 다른 unique 컬럼 기준 (snake_case)
const user = await userRepo.upsert(
  { firstName: 'John', email: 'john@example.com' },
  'email',
);
// → User
```

---

## bulkCreate

여러 row를 단일 `INSERT` 쿼리로 삽입합니다.

```ts
const created = await userRepo.bulkCreate([
  { firstName: 'Alice', email: 'alice@example.com' },
  { firstName: 'Bob',   email: 'bob@example.com'   },
]);
// → User[]
```

---

## select — 플루언트 쿼리 빌더

`repo.select(where?)`는 `QueryBuilder`를 반환합니다.  
메서드를 체인으로 조합한 후 `await` 하거나 `.exec()` 로 실행합니다.

### 기본 조회

```ts
// 전체 조회 (await 직접 사용 가능)
const users = await userRepo.select();

// 초기 WHERE 조건
const users = await userRepo.select({ isActive: true });
```

### WHERE — AND 조건

```ts
// 단순 등호
const users = await userRepo.select().where({ isActive: true });

// 비교 연산자
const users = await userRepo.select()
  .where({ createdAt: { operator: '>=', value: new Date('2024-01-01') } });

// IN
const users = await userRepo.select()
  .where({ id: { operator: 'IN', value: [1, 2, 3] } });

// IS NULL
const users = await userRepo.select()
  .where({ deletedAt: { operator: 'IS NULL' } });

// LIKE / ILIKE (대소문자 무시)
const users = await userRepo.select()
  .where({ email: { operator: 'ILIKE', value: '%@gmail.com' } });
```

지원하는 연산자: `=` `!=` `>` `<` `>=` `<=` `LIKE` `ILIKE` `IN` `NOT IN` `IS NULL` `IS NOT NULL`

### OR — OR 조건

`.or()`를 여러 번 호출하면 각각 OR로 연결됩니다.  
AND 조건이 있을 경우 `WHERE (AND 조건들) OR (OR 조건들)` 형태로 생성됩니다.

```ts
// firstName ILIKE '%john%' OR email ILIKE '%john%'
const users = await userRepo.select({ isActive: true })
  .or({ firstName: { operator: 'ILIKE', value: '%john%' } })
  .or({ email:     { operator: 'ILIKE', value: '%john%' } });
// → WHERE (is_active = true) OR (first_name ILIKE '%john%') OR (email ILIKE '%john%')
```

### ORDER BY

```ts
const users = await userRepo.select()
  .orderBy([{ column: 'createdAt', direction: 'DESC' }]);

// 다중 정렬
const users = await userRepo.select()
  .orderBy([
    { column: 'isActive',  direction: 'DESC' },
    { column: 'createdAt', direction: 'ASC'  },
  ]);
```

### LIMIT / OFFSET

```ts
const users = await userRepo.select()
  .orderBy([{ column: 'id', direction: 'ASC' }])
  .limit(20)
  .offset(40);
// 3페이지 (0-indexed offset)
```

### GROUP BY

```ts
const result = await userRepo.select()
  .groupBy(['isActive'])
  .calculate([
    { fn: 'COUNT', alias: 'count' },
  ]);
// → { count: '42' }
```

### JOIN

```ts
// LEFT JOIN
const result = await userRepo.select({ isActive: true })
  .join({ table: 'orders', on: 'users.id = orders.user_id', type: 'LEFT' })
  .columns(['users.id', 'users.email'])
  .groupBy(['users.id', 'users.email'])
  .orderBy([{ column: 'id', direction: 'ASC' }])
  .exec();
```

JOIN 타입: `INNER` `LEFT` `RIGHT` `FULL`

### 컬럼 지정 (columns)

```ts
const users = await userRepo.select()
  .columns(['id', 'email', 'firstName'])
  .exec();
```

---

## selectOne

`select(where).one()` 의 단축형입니다. 조건에 맞는 첫 번째 row를 반환합니다.

```ts
const user = await userRepo.selectOne({ email: 'john@example.com' });
// → User | null

const user = await userRepo.selectOne({ id: 1 });
if (!user) throw new Error('not found');
```

---

## calculate — 집계 함수

`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`를 실행합니다.

```ts
// 전체 카운트
const result = await userRepo.select().calculate([{ fn: 'COUNT', alias: 'count' }]);
const total = parseInt(String(result.count), 10);

// 다중 집계
const stats = await userRepo.select({ isActive: true })
  .calculate([
    { fn: 'COUNT', alias: 'count' },
    { fn: 'AVG',   column: 'score', alias: 'avgScore' },
    { fn: 'MAX',   column: 'score', alias: 'maxScore' },
  ]);
// → { count: '42', avgScore: '87.5', maxScore: '100' }
```

---

## paginate — OFFSET 페이지네이션

COUNT 쿼리와 DATA 쿼리를 병렬로 실행합니다.

```ts
const result = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .paginate({ page: 1, pageSize: 20 });

// result 구조
// {
//   data:           User[],   // 현재 페이지 데이터
//   count:          150,      // 전체 row 수 (필터 적용)
//   page:           1,
//   pageSize:       20,
//   nextAction:     true,     // 다음 페이지 존재 여부
//   previousAction: false,    // 이전 페이지 존재 여부
// }
```

> 수백만 건 이상의 테이블에서는 `cursorPaginate()` 를 사용하세요.

---

## cursorPaginate — 커서 기반 페이지네이션 (대용량)

OFFSET 스캔 없이 `WHERE id > last_id` 방식으로 동작합니다.  
인덱스가 있는 컬럼을 `cursorColumn`으로 지정하면 수천만 건에서도 일정한 속도를 유지합니다.

```ts
// 첫 페이지
const p1 = await userRepo.select({ isActive: true })
  .cursorPaginate({ pageSize: 20, cursorColumn: 'id' });

// p1 = { data: [...], nextCursor: 'xxx', pageSize: 20, hasNext: true }

// 다음 페이지
if (p1.hasNext) {
  const p2 = await userRepo.select({ isActive: true })
    .cursorPaginate({ pageSize: 20, cursorColumn: 'id', cursor: p1.nextCursor });
}

// 내림차순 커서 (createdAt DESC)
const result = await userRepo.select()
  .cursorPaginate({ pageSize: 20, cursorColumn: 'createdAt', direction: 'desc' });
```

| `paginate` | `cursorPaginate` |
|---|---|
| 전체 count 제공 | count 미제공 |
| page 번호로 이동 | 이전/다음만 가능 |
| 대용량에서 느려짐 | 항상 일정한 속도 |

---

## forEach — 배치 처리

전체 데이터를 메모리에 올리지 않고 청크 단위로 처리합니다.  
대용량 ETL, 이메일 일괄 발송, 데이터 마이그레이션에 적합합니다.

```ts
await userRepo.select({ isActive: true })
  .orderBy([{ column: 'id', direction: 'ASC' }])
  .forEach(async (batch) => {
    // batch: User[] (기본 500개씩)
    await sendEmailBatch(batch);
  }, { batchSize: 200 });
```

---

## stream — 스트리밍 (AsyncGenerator)

`for await...of` 루프로 row를 하나씩 순회합니다.  
내부적으로 배치 단위로 DB를 조회하여 메모리 효율을 유지합니다.

```ts
// for await...of 직접 사용 (Symbol.asyncIterator 지원)
for await (const user of userRepo.select({ isActive: true })) {
  await processRow(user);
}

// 배치 크기 지정
for await (const user of userRepo.select().stream({ batchSize: 1000 })) {
  await processRow(user);
}
```

---

## raw — Raw SQL 직접 실행

복잡한 쿼리가 필요할 때 SQL을 직접 작성합니다.  
결과 컬럼명은 `snake_case → camelCase`로 자동 변환됩니다.

```ts
// repo.raw() 사용
const users = await userRepo.raw<UserRow>(
  'SELECT * FROM users WHERE first_name ILIKE $1 ORDER BY created_at DESC',
  ['%john%'],
);

// QueryBuilder.raw() — 레포지토리 없이 독립적으로 사용
import { QueryBuilder } from 'reltype';

const rows = await QueryBuilder.raw(
  `SELECT u.id, u.email, COUNT(o.id) AS order_count
   FROM users u
   LEFT JOIN orders o ON u.id = o.user_id
   WHERE u.is_active = $1
   GROUP BY u.id, u.email`,
  [true],
);
```

---

## explain — 쿼리 플랜 분석

인덱스 사용 여부 및 성능 병목을 확인합니다.

```ts
// EXPLAIN
const plan = await userRepo.select({ isActive: true }).explain();
console.log(plan);

// EXPLAIN ANALYZE (실제 실행 통계 포함)
const plan = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .explain(true);
```

---

## toSQL — SQL 미리 확인 (디버깅)

실제 실행 없이 생성될 SQL과 params를 반환합니다.

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

## hooks — 쿼리 라이프사이클 훅

### 쿼리별 훅

```ts
const users = await userRepo.select({ isActive: true })
  .hooks({
    beforeExec: ({ sql, params }) => logger.debug('SQL 실행 예정:', sql),
    afterExec:  ({ rows, elapsed }) => metrics.record('db.query.duration', elapsed),
    onError:    ({ err, sql }) => alerting.send({ err, sql }),
  })
  .paginate({ page: 1, pageSize: 20 });
```

### 레포지토리 전역 훅

레포지토리의 모든 `select()` 빌더에 자동 적용됩니다.

```ts
userRepo.useHooks({
  beforeExec: ({ sql }) => logger.debug('SQL:', sql),
  afterExec:  ({ elapsed }) => metrics.histogram('db.latency', elapsed),
  onError:    ({ err }) => logger.error('DB 오류', { kind: err.message }),
});

// 이후 모든 select()에 훅이 적용됨
const users = await userRepo.select({ isActive: true }).exec();
```

---

## 정적 CRUD (findAll / findById / findOne)

단순한 조회에는 정적 메서드를 사용할 수 있습니다.

```ts
// 전체 조회
const users = await userRepo.findAll();

// 조건 + 정렬 + 페이지네이션
const users = await userRepo.findAll({
  where:   { isActive: true },
  orderBy: [{ col: 'createdAt', dir: 'DESC' }],
  limit:   10,
  offset:  0,
});

// PK로 단건 조회
const user = await userRepo.findById(1);         // User | null

// 조건으로 단건 조회 (단순 등호만 지원)
const user = await userRepo.findOne({ email: 'john@example.com' }); // User | null
```

> 연산자(LIKE, IN, OR 등)가 필요한 경우 `repo.select()` 를 사용하세요.

---

## Column Types

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

### Column Modifiers

```ts
col.text().notNull()      // NOT NULL (기본 상태)
col.text().nullable()     // NULL 허용, INSERT 시 optional
col.integer().primaryKey() // PRIMARY KEY, INSERT 시 optional
col.boolean().default()   // DB DEFAULT, INSERT 시 optional
col.timestamptz().defaultNow() // DEFAULT NOW(), INSERT 시 optional
```

---

## Transaction

```ts
import { runInTx } from 'reltype';

const result = await runInTx(async (client) => {
  await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });
  await userRepo.create({ firstName: 'Bob',   email: 'bob@example.com'   });
  return 'done';
});
// 하나라도 실패 시 자동 ROLLBACK
```

---

## Connection Pool

```ts
import { getPool, withClient, closePool } from 'reltype';

// Pool 직접 접근
const pool = getPool();

// Client 빌려서 Raw 쿼리 실행
const rows = await withClient(async (client) => {
  const result = await client.query('SELECT NOW()');
  return result.rows;
});

// 애플리케이션 종료 시
await closePool();
```

---

## Raw Query Builders

Repository 없이 직접 쿼리를 빌드할 수 있습니다.

```ts
import { buildSelect, buildInsert, buildUpdate, buildDelete, buildUpsert, buildBulkInsert, withClient } from 'reltype';

// SELECT
const { sql, params } = buildSelect('users', {
  where:   { isActive: true },
  orderBy: [{ col: 'createdAt', dir: 'DESC' }],
  limit:   5,
});

// INSERT
const built = buildInsert('users', { firstName: 'John', email: 'john@example.com' });

// UPDATE
const built = buildUpdate('users', { firstName: 'Jane' }, { id: 1 });

// DELETE
const built = buildDelete('users', { id: 1 });

// UPSERT
const built = buildUpsert('users', { id: 1, firstName: 'John', email: 'john@example.com' }, 'id');

// BULK INSERT
const built = buildBulkInsert('users', [
  { firstName: 'Alice', email: 'alice@example.com' },
  { firstName: 'Bob',   email: 'bob@example.com'   },
]);

// 실행
await withClient(async (client) => {
  const result = await client.query(sql, params);
  return result.rows;
});
```

> 모든 쿼리 빌더는 camelCase key → snake_case 컬럼명으로 자동 변환합니다.

---

## Case Conversion Utilities

```ts
import { toCamel, toSnake, keysToCamel, keysToSnake } from 'reltype';

toCamel('first_name')   // 'firstName'
toSnake('firstName')    // 'first_name'

keysToCamel({ first_name: 'John', created_at: new Date() })
// { firstName: 'John', createdAt: Date }

keysToSnake({ firstName: 'John', createdAt: new Date() })
// { first_name: 'John', created_at: Date }
```

---

## Logger

```ts
import { Logger } from 'reltype';

const logger = Logger.fromEnv(process.env as Record<string, string | undefined>, {
  prefix: '[MyApp]',
  level:  'info',
});

logger.debug('debug message');
logger.info('info message');
logger.warn('warn message');
logger.error('error message', new Error('oops'));
```

환경 변수 `LOGGER=true`, `LOG_LEVEL=debug` 으로 활성화합니다.

---

## Extending BaseRepo

커스텀 메서드를 추가하려면 `BaseRepo`를 상속합니다.

```ts
import { BaseRepo, InferRow } from 'reltype';
import { usersTable } from './schema';

class UserRepo extends BaseRepo<typeof usersTable> {
  async findActiveUsers(): Promise<InferRow<typeof usersTable>[]> {
    return this.findAll({ where: { isActive: true } });
  }

  async findByEmail(email: string): Promise<InferRow<typeof usersTable> | null> {
    return this.findOne({ email });
  }
}

export const userRepo = new UserRepo(usersTable);
```

---

## Error Handling

### DbError — PostgreSQL 에러 분류

모든 DB 에러는 자동으로 `DbError`로 변환됩니다.  
`DbError`는 내부 로그용 상세 정보와 사용자 노출용 메시지를 분리합니다.

```ts
import { DbError } from 'reltype';

try {
  await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });
} catch (err) {
  if (err instanceof DbError) {
    // 사용자에게 안전하게 노출
    console.log(err.toUserPayload());
    // { error: '이미 존재하는 값입니다.', kind: 'uniqueViolation', isRetryable: false }

    // 내부 로깅용 상세 정보
    console.log(err.toLogContext());
    // { pgCode: '23505', kind: 'uniqueViolation', table: 'users', constraint: '...', ... }

    // 재시도 가능 여부 확인
    if (err.isRetryable) {
      // 재시도 로직
    }
  }
}
```

### Express에서 사용하는 예시

```ts
app.post('/users', async (req, res) => {
  try {
    const user = await userRepo.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof DbError) {
      const status = err.kind === 'uniqueViolation' ? 409
                   : err.kind === 'notNullViolation' ? 400
                   : err.isRetryable               ? 503
                   : 500;
      res.status(status).json(err.toUserPayload());
    } else {
      res.status(500).json({ error: '알 수 없는 오류가 발생했습니다.' });
    }
  }
});
```

### DbErrorKind 전체 목록

| kind | PostgreSQL SQLSTATE | 설명 | isRetryable |
|---|---|---|---|
| `uniqueViolation` | 23505 | UNIQUE 제약 위반 | false |
| `foreignKeyViolation` | 23503 | FK 제약 위반 | false |
| `notNullViolation` | 23502 | NOT NULL 위반 | false |
| `checkViolation` | 23514 | CHECK 제약 위반 | false |
| `deadlock` | 40P01 | 교착 상태 | **true** |
| `serializationFailure` | 40001 | 직렬화 실패 | **true** |
| `connectionFailed` | 08xxx | 연결 실패 | **true** |
| `tooManyConnections` | 53300 | 연결 수 초과 | **true** |
| `queryTimeout` | 57014 | 쿼리 타임아웃 | false |
| `undefinedTable` | 42P01 | 테이블 없음 | false |
| `undefinedColumn` | 42703 | 컬럼 없음 | false |
| `invalidInput` | 22xxx | 잘못된 입력 형식 | false |
| `unknown` | 기타 | 분류 불가 | false |

---

## Pool Monitoring

```ts
import { getPoolStatus, checkPoolHealth } from 'reltype';

// 현재 Pool 상태 조회
const status = getPoolStatus();
console.log(status);
// {
//   totalCount:   5,     // 총 생성된 연결 수
//   idleCount:    3,     // 유휴 연결 수
//   waitingCount: 0,     // 연결 대기 중인 요청 수
//   isHealthy:    true   // 정상 여부
// }

// DB 서버와의 연결 헬스체크 (SELECT 1)
const isAlive = await checkPoolHealth();
```

### Too Many Connections 방지

`.env`에서 Pool 크기와 타임아웃을 반드시 설정하세요.

```env
DB_MAX=10                    # 최대 연결 풀 크기 (기본값: 10)
DB_CONNECTION_TIMEOUT=3000   # 연결 획득 타임아웃 ms (미설정 시 무한 대기 경고)
DB_IDLE_TIMEOUT=30000        # 유휴 연결 해제 시간 ms
DB_STATEMENT_TIMEOUT=10000   # SQL 문 최대 실행 시간 ms
```

> `DB_CONNECTION_TIMEOUT`이 설정되지 않으면 Pool 소진 시 요청이 무한 대기합니다.  
> 반드시 설정하세요.

---

## Log System

### 포맷 설정

```env
LOGGER=true         # 로거 활성화
LOG_LEVEL=debug     # debug / info / log / warn / error
LOG_FORMAT=json     # text(기본) / json(프로덕션 권장)
```

### text 포맷 (개발 환경)

```
2024-01-01T00:00:00.000Z [Pool] INFO Pool 생성 완료 { max: 10, ... }
2024-01-01T00:00:00.000Z [Repo] DEBUG SQL: SELECT * FROM users WHERE id = $1 [ 1 ]
2024-01-01T00:00:00.000Z [Repo] DEBUG 완료 (12ms) rowCount=1
```

### json 포맷 (프로덕션 / 로그 수집기)

```json
{"ts":"2024-01-01T00:00:00.000Z","level":"INFO","prefix":"[Pool]","msg":"Pool 생성 완료","meta":[{"max":10}]}
{"ts":"2024-01-01T00:00:00.000Z","level":"ERROR","prefix":"[Repo]","msg":"쿼리 실패 [users]","meta":[{"pgCode":"23505","kind":"uniqueViolation","constraint":"users_email_key"}]}
```

### 로그 이벤트 목록

| 레벨 | prefix | 이벤트 |
|---|---|---|
| INFO | [Pool] | Pool 생성 완료 / Pool 종료 |
| WARN | [Pool] | connectionTimeoutMillis 미설정 경고 |
| WARN | [Pool] | 최대 연결 수 도달 |
| DEBUG | [Pool] | 새 연결 생성 / 연결 제거 |
| ERROR | [Pool] | 유휴 클라이언트 오류 / 클라이언트 획득 실패 |
| DEBUG | [Repo] | SQL 실행 + 소요시간 |
| ERROR | [Repo] | 쿼리 실패 (pgCode, kind, 소요시간 포함) |
| DEBUG | [Tx] | 트랜잭션 시작 / 커밋 |
| WARN | [Tx] | 트랜잭션 롤백 |
| ERROR | [Tx] | 롤백 실패 |

---

## Architecture

```
src/
├── index.ts                  ← 공개 API 진입점
├── configs/env.ts            ← DB 설정 파싱
├── utils/
│   ├── logger.ts             ← Logger 클래스
│   └── reader.ts             ← env 파서, PostgresConfig
└── features/
    ├── schema/               ← defineTable, col, InferRow/Insert/Update
    ├── transform/            ← camelCase ↔ snake_case 변환
    ├── connection/           ← Pool 관리, Transaction
    ├── query/                ← SQL 쿼리 빌더 (select/insert/update/delete/upsert/bulkInsert)
    └── repository/           ← BaseRepo, createRepo, IRepo
```

---

## Contributing

버그 리포트, 기능 제안, PR 모두 환영합니다.  
→ [Issues](https://github.com/psh-suhyun/reltype/issues) · [Pull Requests](https://github.com/psh-suhyun/reltype/pulls)

---

## Changelog

전체 변경 이력은 [CHANGELOG.md](./CHANGELOG.md) 를 참고하세요.

---

## License

MIT
