# reltype

[![npm version](https://img.shields.io/npm/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![npm downloads](https://img.shields.io/npm/dm/reltype.svg)](https://www.npmjs.com/package/reltype)
[![license](https://img.shields.io/npm/l/reltype.svg)](https://github.com/psh-suhyun/reltype/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

**Type-first relational modeling for PostgreSQL in TypeScript.**

Define your PostgreSQL tables in TypeScript code and get fully-typed query results automatically.

- **Type-safe** — INSERT / SELECT / UPDATE types are automatically inferred from your schema
- **camelCase ↔ snake_case** — Automatic conversion between DB column names and TypeScript variables
- **Fluent query builder** — Chain `WHERE`, `OR`, `JOIN`, `GROUP BY`, `LIMIT`, `paginate`, `calculate`, `stream` and more
- **Large data optimization** — Cursor pagination, batch processing, AsyncGenerator streaming
- **Error classification** — `DbError` automatically classifies PostgreSQL errors into 13 distinct kinds
- **Hook system** — Before/after query lifecycle hooks for monitoring and APM integration

> 한국어 문서는 [README.ko.md](./README.ko.md) 를 참고하세요.

---

## Installation

```bash
# Install reltype
npm install reltype

# pg is a peerDependency — install it separately
npm install pg
npm install --save-dev @types/pg
```

> Requires `pg` version 8.0.0 or higher.

---

## Environment Variables

Create a `.env` file in your project root.

```env
# ── Required (either CONNECTION_STRING or DB_NAME must be set) ───────────────

# Option 1: Connection String (takes priority)
DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/mydb

# Option 2: Individual settings
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres

# ── Optional ─────────────────────────────────────────────────────────────────

DB_SSL=false                      # Enable SSL
DB_MAX=10                         # Max connection pool size
DB_IDLE_TIMEOUT=30000             # Idle connection timeout (ms)
DB_CONNECTION_TIMEOUT=2000        # Connection acquisition timeout (ms)
DB_ALLOW_EXIT_ON_IDLE=false       # Allow process exit when idle
DB_STATEMENT_TIMEOUT=0            # SQL statement timeout (ms, 0 = unlimited)
DB_QUERY_TIMEOUT=0                # Query timeout (ms, 0 = unlimited)
DB_APPLICATION_NAME=my-app        # App name shown in pg_stat_activity
DB_KEEP_ALIVE=true                # Enable TCP keep-alive
DB_KEEP_ALIVE_INITIAL_DELAY=10000 # Initial keep-alive delay (ms)

# ── Logging ───────────────────────────────────────────────────────────────────

LOGGER=true                       # Enable logger (true / false)
LOG_LEVEL=info                    # Log level (debug / info / log / warn / error)
```

---

## Quick Start

### 1. Define a Table Schema

```ts
import { defineTable, col } from 'reltype';

export const usersTable = defineTable('users', {
  id:        col.serial().primaryKey(),       // SERIAL PRIMARY KEY (optional on INSERT)
  firstName: col.varchar(255).notNull(),      // VARCHAR(255) NOT NULL
  lastName:  col.varchar(255).nullable(),     // VARCHAR(255) NULL (optional on INSERT)
  email:     col.text().notNull(),            // TEXT NOT NULL
  isActive:  col.boolean().default(),         // BOOLEAN DEFAULT ... (optional on INSERT)
  createdAt: col.timestamptz().defaultNow(),  // TIMESTAMPTZ DEFAULT NOW() (optional on INSERT)
});
```

### 2. Automatic Type Inference

```ts
import { InferRow, InferInsert, InferUpdate } from 'reltype';

// SELECT result type
type User = InferRow<typeof usersTable>;
// {
//   id: number;
//   firstName: string;
//   lastName: string | null;
//   email: string;
//   isActive: boolean;
//   createdAt: Date;
// }

// INSERT input type (optional columns automatically excluded)
type CreateUser = InferInsert<typeof usersTable>;
// { firstName: string; email: string; lastName?: string | null; isActive?: boolean; createdAt?: Date }

// UPDATE input type (PK excluded, all fields optional)
type UpdateUser = InferUpdate<typeof usersTable>;
// { firstName?: string; lastName?: string | null; email?: string; isActive?: boolean; createdAt?: Date }
```

### 3. Load dotenv at Application Entry Point

`reltype` only reads `process.env`. Load your `.env` file **at the application entry point**.

```ts
// Application entry point (index.ts / server.ts / app.ts)
import 'dotenv/config';  // Must be placed before other imports

// Then import reltype
import { getDatabaseConfig, getPool } from 'reltype';
```

### 4. Create a Repository

```ts
import { createRepo } from 'reltype';
import { usersTable } from './schema';

export const userRepo = createRepo(usersTable);
```

---

## Repository API

### Method Summary

| Method | Return Type | Description |
|---|---|---|
| `create(data)` | `Promise<T>` | INSERT a single row |
| `update(id, data)` | `Promise<T \| null>` | UPDATE by primary key |
| `delete(id)` | `Promise<boolean>` | DELETE by primary key |
| `upsert(data, col?)` | `Promise<T>` | INSERT or UPDATE |
| `bulkCreate(rows)` | `Promise<T[]>` | INSERT multiple rows |
| `select(where?)` | `QueryBuilder<T>` | Start a fluent query builder |
| `selectOne(where)` | `Promise<T \| null>` | Fetch a single row |
| `raw(sql, params?)` | `Promise<R[]>` | Execute raw SQL |
| `findAll(opts?)` | `Promise<T[]>` | Static full query |
| `findById(id)` | `Promise<T \| null>` | Fetch single row by PK |
| `findOne(where)` | `Promise<T \| null>` | Fetch single row by condition |
| `useHooks(h)` | `this` | Register global hooks |

---

## create

INSERT a single row. Columns with `serial`, `default`, or `nullable` modifiers are optional.

```ts
const user = await userRepo.create({
  firstName: 'John',
  email:     'john@example.com',
  // lastName, isActive, createdAt → optional (DB default or nullable)
});
// → User
```

---

## update

UPDATE only the specified columns by primary key. Returns `null` if the row does not exist.

```ts
// Partial update
const updated = await userRepo.update(1, {
  firstName: 'Jane',
  isActive:  false,
});
// → User | null

if (!updated) {
  throw new Error('User not found.');
}
```

---

## delete

DELETE by primary key. Returns `true` if a row was deleted, `false` if not found.

```ts
const deleted = await userRepo.delete(1);
// → boolean

if (!deleted) {
  throw new Error('User not found.');
}
```

---

## upsert

INSERT or UPDATE based on a conflict column.

```ts
// By PK (id) — default
const user = await userRepo.upsert({
  id:        1,
  firstName: 'John',
  email:     'john@example.com',
});

// By another unique column (snake_case)
const user = await userRepo.upsert(
  { firstName: 'John', email: 'john@example.com' },
  'email',
);
// → User
```

---

## bulkCreate

Insert multiple rows with a single `INSERT` query.

```ts
const created = await userRepo.bulkCreate([
  { firstName: 'Alice', email: 'alice@example.com' },
  { firstName: 'Bob',   email: 'bob@example.com'   },
]);
// → User[]
```

---

## select — Fluent Query Builder

`repo.select(where?)` returns a `QueryBuilder`.  
Chain methods and then `await` or call `.exec()` to execute.

### Basic Query

```ts
// Fetch all (await directly — thenable)
const users = await userRepo.select();

// With initial WHERE condition
const users = await userRepo.select({ isActive: true });
```

### WHERE — AND Conditions

```ts
// Simple equality
const users = await userRepo.select().where({ isActive: true });

// Comparison operator
const users = await userRepo.select()
  .where({ createdAt: { operator: '>=', value: new Date('2024-01-01') } });

// IN
const users = await userRepo.select()
  .where({ id: { operator: 'IN', value: [1, 2, 3] } });

// IS NULL
const users = await userRepo.select()
  .where({ deletedAt: { operator: 'IS NULL' } });

// LIKE / ILIKE (case-insensitive)
const users = await userRepo.select()
  .where({ email: { operator: 'ILIKE', value: '%@gmail.com' } });
```

Supported operators: `=` `!=` `>` `<` `>=` `<=` `LIKE` `ILIKE` `IN` `NOT IN` `IS NULL` `IS NOT NULL`

### OR — OR Conditions

Each `.or()` call adds an OR clause.  
When AND conditions are present, the result is `WHERE (AND conditions) OR (OR conditions)`.

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

// Multiple sort columns
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
// Page 3 (0-indexed offset)
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

JOIN types: `INNER` `LEFT` `RIGHT` `FULL`

### Column Selection (columns)

```ts
const users = await userRepo.select()
  .columns(['id', 'email', 'firstName'])
  .exec();
```

---

## selectOne

Shorthand for `select(where).one()`. Returns the first matching row.

```ts
const user = await userRepo.selectOne({ email: 'john@example.com' });
// → User | null

const user = await userRepo.selectOne({ id: 1 });
if (!user) throw new Error('not found');
```

---

## calculate — Aggregate Functions

Runs `COUNT`, `SUM`, `AVG`, `MIN`, `MAX` aggregations.

```ts
// Total count
const result = await userRepo.select().calculate([{ fn: 'COUNT', alias: 'count' }]);
const total = parseInt(String(result.count), 10);

// Multiple aggregations
const stats = await userRepo.select({ isActive: true })
  .calculate([
    { fn: 'COUNT', alias: 'count' },
    { fn: 'AVG',   column: 'score', alias: 'avgScore' },
    { fn: 'MAX',   column: 'score', alias: 'maxScore' },
  ]);
// → { count: '42', avgScore: '87.5', maxScore: '100' }
```

---

## paginate — OFFSET Pagination

Runs COUNT and DATA queries in parallel.

```ts
const result = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .paginate({ page: 1, pageSize: 20 });

// result shape
// {
//   data:           User[],   // Current page data
//   count:          150,      // Total matching rows
//   page:           1,
//   pageSize:       20,
//   nextAction:     true,     // Next page exists
//   previousAction: false,    // Previous page exists
// }
```

> For tables with millions of rows, use `cursorPaginate()` instead.

---

## cursorPaginate — Cursor-based Pagination (Large Data)

Uses `WHERE id > last_id` instead of OFFSET scanning.  
Assigning an indexed column as `cursorColumn` ensures consistent speed even with tens of millions of rows.

```ts
// First page
const p1 = await userRepo.select({ isActive: true })
  .cursorPaginate({ pageSize: 20, cursorColumn: 'id' });

// p1 = { data: [...], nextCursor: 'xxx', pageSize: 20, hasNext: true }

// Next page
if (p1.hasNext) {
  const p2 = await userRepo.select({ isActive: true })
    .cursorPaginate({ pageSize: 20, cursorColumn: 'id', cursor: p1.nextCursor });
}

// Descending cursor (createdAt DESC)
const result = await userRepo.select()
  .cursorPaginate({ pageSize: 20, cursorColumn: 'createdAt', direction: 'desc' });
```

| `paginate` | `cursorPaginate` |
|---|---|
| Provides total count | No total count |
| Navigate by page number | Next / previous only |
| Slows down on large tables | Consistent speed always |

---

## forEach — Batch Processing

Processes data in chunks without loading everything into memory.  
Ideal for large-scale ETL, bulk email sending, and data migration.

```ts
await userRepo.select({ isActive: true })
  .orderBy([{ column: 'id', direction: 'ASC' }])
  .forEach(async (batch) => {
    // batch: User[] (default 500 rows per chunk)
    await sendEmailBatch(batch);
  }, { batchSize: 200 });
```

---

## stream — Streaming (AsyncGenerator)

Iterates rows one by one with `for await...of`.  
Internally fetches in batches to keep memory usage low.

```ts
// Direct for await...of (Symbol.asyncIterator supported)
for await (const user of userRepo.select({ isActive: true })) {
  await processRow(user);
}

// With custom batch size
for await (const user of userRepo.select().stream({ batchSize: 1000 })) {
  await processRow(user);
}
```

---

## raw — Raw SQL Execution

Write SQL directly when complex queries are needed.  
Result column names are automatically converted from `snake_case` to `camelCase`.

```ts
// repo.raw()
const users = await userRepo.raw<UserRow>(
  'SELECT * FROM users WHERE first_name ILIKE $1 ORDER BY created_at DESC',
  ['%john%'],
);

// QueryBuilder.raw() — standalone, no repository needed
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

## explain — Query Plan Analysis

Inspect index usage and identify performance bottlenecks.

```ts
// EXPLAIN
const plan = await userRepo.select({ isActive: true }).explain();
console.log(plan);

// EXPLAIN ANALYZE (includes actual execution statistics)
const plan = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .explain(true);
```

---

## toSQL — Preview SQL (Debugging)

Returns the generated SQL and params without executing the query.

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

## hooks — Query Lifecycle Hooks

### Per-query Hooks

```ts
const users = await userRepo.select({ isActive: true })
  .hooks({
    beforeExec: ({ sql, params }) => logger.debug('About to run SQL:', sql),
    afterExec:  ({ rows, elapsed }) => metrics.record('db.query.duration', elapsed),
    onError:    ({ err, sql }) => alerting.send({ err, sql }),
  })
  .paginate({ page: 1, pageSize: 20 });
```

### Repository-level Global Hooks

Automatically applied to all `select()` builders on this repository.

```ts
userRepo.useHooks({
  beforeExec: ({ sql }) => logger.debug('SQL:', sql),
  afterExec:  ({ elapsed }) => metrics.histogram('db.latency', elapsed),
  onError:    ({ err }) => logger.error('DB error', { message: err.message }),
});

// All subsequent select() calls will use the hooks
const users = await userRepo.select({ isActive: true }).exec();
```

---

## Static CRUD (findAll / findById / findOne)

Use static methods for simple queries.

```ts
// Fetch all
const users = await userRepo.findAll();

// With filter, sort, and pagination
const users = await userRepo.findAll({
  where:   { isActive: true },
  orderBy: [{ col: 'createdAt', dir: 'DESC' }],
  limit:   10,
  offset:  0,
});

// Single row by PK
const user = await userRepo.findById(1);         // User | null

// Single row by condition (equality only)
const user = await userRepo.findOne({ email: 'john@example.com' }); // User | null
```

> For operators like `LIKE`, `IN`, or `OR`, use `repo.select()` instead.

---

## Column Types

| Method | PostgreSQL Type | TypeScript Type |
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
| `col.jsonb<T>()` | `JSONB` | `T` (default `unknown`) |

### Column Modifiers

```ts
col.text().notNull()           // NOT NULL (default state)
col.text().nullable()          // Allow NULL, optional on INSERT
col.integer().primaryKey()     // PRIMARY KEY, optional on INSERT
col.boolean().default()        // DB DEFAULT, optional on INSERT
col.timestamptz().defaultNow() // DEFAULT NOW(), optional on INSERT
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
// Automatically rolls back if any operation fails
```

---

## Connection Pool

```ts
import { getPool, withClient, closePool } from 'reltype';

// Direct pool access
const pool = getPool();

// Borrow a client and run a raw query
const rows = await withClient(async (client) => {
  const result = await client.query('SELECT NOW()');
  return result.rows;
});

// On application shutdown
await closePool();
```

---

## Raw Query Builders

Build queries directly without a repository.

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

// Execute
await withClient(async (client) => {
  const result = await client.query(sql, params);
  return result.rows;
});
```

> All query builders automatically convert camelCase keys to snake_case column names.

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

Enable with environment variables: `LOGGER=true`, `LOG_LEVEL=debug`.

---

## Extending BaseRepo

Extend `BaseRepo` to add custom methods.

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

### DbError — PostgreSQL Error Classification

All DB errors are automatically converted to `DbError`.  
`DbError` separates internal log details from user-facing messages.

```ts
import { DbError } from 'reltype';

try {
  await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });
} catch (err) {
  if (err instanceof DbError) {
    // Safe to expose to users
    console.log(err.toUserPayload());
    // { error: 'A duplicate value already exists.', kind: 'uniqueViolation', isRetryable: false }

    // Internal logging details
    console.log(err.toLogContext());
    // { pgCode: '23505', kind: 'uniqueViolation', table: 'users', constraint: '...', ... }

    // Check if retryable
    if (err.isRetryable) {
      // retry logic
    }
  }
}
```

### Example with Express

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
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
});
```

### DbErrorKind Reference

| kind | PostgreSQL SQLSTATE | Description | isRetryable |
|---|---|---|---|
| `uniqueViolation` | 23505 | UNIQUE constraint violation | false |
| `foreignKeyViolation` | 23503 | Foreign key constraint violation | false |
| `notNullViolation` | 23502 | NOT NULL constraint violation | false |
| `checkViolation` | 23514 | CHECK constraint violation | false |
| `deadlock` | 40P01 | Deadlock detected | **true** |
| `serializationFailure` | 40001 | Serialization failure | **true** |
| `connectionFailed` | 08xxx | Connection failure | **true** |
| `tooManyConnections` | 53300 | Too many connections | **true** |
| `queryTimeout` | 57014 | Query timeout | false |
| `undefinedTable` | 42P01 | Table does not exist | false |
| `undefinedColumn` | 42703 | Column does not exist | false |
| `invalidInput` | 22xxx | Invalid input format | false |
| `unknown` | other | Unclassified error | false |

---

## Pool Monitoring

```ts
import { getPoolStatus, checkPoolHealth } from 'reltype';

// Get current pool status
const status = getPoolStatus();
console.log(status);
// {
//   totalCount:   5,     // Total connections created
//   idleCount:    3,     // Idle connections
//   waitingCount: 0,     // Requests waiting for a connection
//   isHealthy:    true   // Pool is healthy
// }

// Health check against the DB server (SELECT 1)
const isAlive = await checkPoolHealth();
```

### Preventing Too Many Connections

Always configure pool size and timeouts in your `.env`.

```env
DB_MAX=10                    # Max pool size (default: 10)
DB_CONNECTION_TIMEOUT=3000   # Connection acquisition timeout in ms (infinite wait if not set — warning)
DB_IDLE_TIMEOUT=30000        # Idle connection release time in ms
DB_STATEMENT_TIMEOUT=10000   # Max SQL statement execution time in ms
```

> If `DB_CONNECTION_TIMEOUT` is not set, requests will wait indefinitely when the pool is exhausted.  
> Always configure this value.

---

## Log System

### Format Configuration

```env
LOGGER=true         # Enable logger
LOG_LEVEL=debug     # debug / info / log / warn / error
LOG_FORMAT=json     # text (default) / json (recommended for production)
```

### text format (development)

```
2024-01-01T00:00:00.000Z [Pool] INFO  Pool created { max: 10, ... }
2024-01-01T00:00:00.000Z [Repo] DEBUG SQL: SELECT * FROM users WHERE id = $1 [ 1 ]
2024-01-01T00:00:00.000Z [Repo] DEBUG Done (12ms) rowCount=1
```

### json format (production / log aggregators)

```json
{"ts":"2024-01-01T00:00:00.000Z","level":"INFO","prefix":"[Pool]","msg":"Pool created","meta":[{"max":10}]}
{"ts":"2024-01-01T00:00:00.000Z","level":"ERROR","prefix":"[Repo]","msg":"Query failed [users]","meta":[{"pgCode":"23505","kind":"uniqueViolation","constraint":"users_email_key"}]}
```

### Log Event Reference

| Level | Prefix | Event |
|---|---|---|
| INFO | [Pool] | Pool created / Pool closed |
| WARN | [Pool] | connectionTimeoutMillis not configured |
| WARN | [Pool] | Max connections reached |
| DEBUG | [Pool] | New connection / Connection removed |
| ERROR | [Pool] | Idle client error / Client acquisition failed |
| DEBUG | [Repo] | SQL executed + elapsed time |
| ERROR | [Repo] | Query failed (pgCode, kind, elapsed included) |
| DEBUG | [Tx] | Transaction started / committed |
| WARN | [Tx] | Transaction rolled back |
| ERROR | [Tx] | Rollback failed |

---

## Architecture

```
src/
├── index.ts                  ← Public API entry point
├── configs/env.ts            ← DB config parsing
├── utils/
│   ├── logger.ts             ← Logger class
│   └── reader.ts             ← Env parser, PostgresConfig
└── features/
    ├── schema/               ← defineTable, col, InferRow/Insert/Update
    ├── transform/            ← camelCase ↔ snake_case conversion
    ├── connection/           ← Pool management, Transaction
    ├── query/                ← SQL query builders (select/insert/update/delete/upsert/bulkInsert)
    └── repository/           ← BaseRepo, createRepo, IRepo
```

---

## Contributing

Bug reports, feature suggestions, and pull requests are all welcome.  
→ [Issues](https://github.com/psh-suhyun/reltype/issues) · [Pull Requests](https://github.com/psh-suhyun/reltype/pulls)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full version history.

---

## License

MIT
