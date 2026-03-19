# reltype

[![npm version](https://img.shields.io/npm/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![npm downloads](https://img.shields.io/npm/dm/reltype.svg)](https://www.npmjs.com/package/reltype)
[![license](https://img.shields.io/npm/l/reltype.svg)](https://github.com/psh-suhyun/reltype/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/reltype.svg)](https://www.npmjs.com/package/reltype)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

> 한국어 문서 → [README.ko.md](./README.ko.md)

**The PostgreSQL query library that gets out of your way.**

No Prisma schema. No decorators. No code generation. No migrations.  
Just TypeScript — define your table once, get fully-typed queries instantly.

```ts
// Define once
const usersTable = defineTable('users', {
  id:        col.serial().primaryKey(),
  firstName: col.varchar(255).notNull(),
  email:     col.text().notNull(),
  isActive:  col.boolean().default(),
  createdAt: col.timestamptz().defaultNow(),
});

// Use everywhere — fully typed, zero boilerplate
const page = await userRepo
  .select({ isActive: true })
  .where({ email: { operator: 'ILIKE', value: '%@gmail.com' } })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .paginate({ page: 1, pageSize: 20 });
// → { data: User[], count: 150, page: 1, pageSize: 20, nextAction: true, previousAction: false }
```

---

## Why reltype?

### The problem with existing tools

| | Prisma | TypeORM | Drizzle | **reltype** |
|---|---|---|---|---|
| Schema definition | `schema.prisma` file | Decorators on class | TS schema | **TS schema** |
| Code generation required | ✅ Yes | ❌ No | ❌ No | **❌ No** |
| Migration CLI required | ✅ Yes | Optional | Optional | **❌ Never** |
| camelCase ↔ snake_case | Manual config | Manual config | Manual config | **Automatic** |
| Raw SQL support | Limited | Yes | Yes | **Yes** |
| Bundle size | Heavy | Heavy | Light | **Minimal** |
| Large data streaming | Plugin needed | Custom | Custom | **Built-in** |

### What makes reltype different

**1. Define once, types everywhere**  
Write your schema in TypeScript. `INSERT`, `SELECT`, and `UPDATE` types are automatically inferred — no duplicated interfaces, no `@Entity`, no `model User {}`.

**2. camelCase ↔ snake_case is fully automatic**  
Your DB has `first_name`, `created_at`, `is_active`. Your TypeScript has `firstName`, `createdAt`, `isActive`. reltype handles the mapping in both directions, always, for free.

**3. No build step, no CLI, no migration files**  
`npm install reltype` and start writing queries. That's it.

**4. Large-scale production ready**  
Cursor-based pagination, AsyncGenerator streaming, batch processing, connection pool monitoring, structured error classification, and lifecycle hooks — all built in.

---

## Installation

```bash
npm install reltype pg
npm install --save-dev @types/pg
```

> `pg` (node-postgres) is a peer dependency. Version 8.0.0+ required.

---

## 2-Minute Quick Start

### Step 1 — Environment Variables

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

Or use a connection string:

```env
DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/mydb
```

### Step 2 — Load dotenv at entry point

```ts
// index.ts — must be the very first line
import 'dotenv/config';

import { getPool } from 'reltype';
```

### Step 3 — Define a table schema

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

// Types are automatically available — no extra code needed
// InferRow<typeof usersTable>    → full SELECT result type
// InferInsert<typeof usersTable> → INSERT input (required/optional by modifier)
// InferUpdate<typeof usersTable> → UPDATE input (PK excluded, all optional)
```

### Step 4 — Create a repository and query

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

Done. You now have a fully-typed, production-ready data layer.

---

## Type Inference — The Core Magic

Define your schema once. reltype infers all types automatically:

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
//   firstName: string;   ← required (notNull, no default)
//   email: string;       ← required
//   lastName?: string | null;  ← optional (nullable)
//   isActive?: boolean;        ← optional (has DB default)
//   createdAt?: Date;          ← optional (defaultNow)
// }
// id is excluded — serial auto-generates it

type UpdateUser = InferUpdate<typeof usersTable>;
// {
//   firstName?: string;
//   lastName?: string | null;
//   email?: string;
//   isActive?: boolean;
//   createdAt?: Date;
// }
// id is excluded — it's the lookup key
```

If you change a column in the schema, TypeScript will immediately catch every call site that's now incorrect. **Your schema is the single source of truth.**

---

## Repository API

| Method | Returns | Description |
|---|---|---|
| `create(data)` | `Promise<T>` | INSERT one row |
| `update(id, data)` | `Promise<T \| null>` | UPDATE by primary key |
| `delete(id)` | `Promise<boolean>` | DELETE by primary key |
| `upsert(data, col?)` | `Promise<T>` | INSERT or UPDATE on conflict |
| `bulkCreate(rows)` | `Promise<T[]>` | INSERT multiple rows in one query |
| `select(where?)` | `QueryBuilder<T>` | Start a fluent query |
| `selectOne(where)` | `Promise<T \| null>` | Fetch one row |
| `raw(sql, params?)` | `Promise<R[]>` | Execute raw SQL |
| `findAll(opts?)` | `Promise<T[]>` | Simple query with filter/sort/limit |
| `findById(id)` | `Promise<T \| null>` | Fetch by primary key |
| `findOne(where)` | `Promise<T \| null>` | Fetch by equality conditions |
| `useHooks(h)` | `this` | Register global lifecycle hooks |

---

## Fluent Query Builder

`repo.select(where?)` returns a `QueryBuilder`. Chain methods freely, then `await` to execute.

### Filtering (WHERE / OR)

```ts
// Simple equality
const users = await userRepo.select({ isActive: true });

// Operators: =, !=, >, <, >=, <=, LIKE, ILIKE, IN, NOT IN, IS NULL, IS NOT NULL
const users = await userRepo.select()
  .where({ createdAt: { operator: '>=', value: new Date('2024-01-01') } })
  .where({ id:        { operator: 'IN', value: [1, 2, 3] }             });

// OR conditions
const users = await userRepo.select({ isActive: true })
  .or({ firstName: { operator: 'ILIKE', value: '%john%' } })
  .or({ email:     { operator: 'ILIKE', value: '%john%' } });
// → WHERE (is_active = true) OR (first_name ILIKE '%john%') OR (email ILIKE '%john%')

// NULL check
const unverified = await userRepo.select()
  .where({ verifiedAt: { operator: 'IS NULL' } });
```

### Sorting, Paging, Grouping

```ts
const users = await userRepo.select()
  .orderBy([
    { column: 'isActive',  direction: 'DESC' },
    { column: 'createdAt', direction: 'ASC'  },
  ])
  .limit(20)
  .offset(40);  // Page 3

// GROUP BY + aggregate
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

> JOIN types: `INNER` · `LEFT` · `RIGHT` · `FULL`

### Debug — Preview SQL before running

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

## Pagination

### OFFSET pagination — for standard lists

```ts
const result = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .paginate({ page: 1, pageSize: 20 });

// {
//   data:           User[],
//   count:          150,     ← total matching rows (COUNT query runs automatically)
//   page:           1,
//   pageSize:       20,
//   nextAction:     true,    ← has next page
//   previousAction: false,   ← no previous page
// }
```

### Cursor pagination — for massive tables

OFFSET gets slower with every page. Cursor pagination doesn't.  
`WHERE id > last_id` scans no extra rows, regardless of how deep you are.

```ts
// Page 1
const p1 = await userRepo.select({ isActive: true })
  .cursorPaginate({ pageSize: 20, cursorColumn: 'id' });
// → { data: [...], nextCursor: 'eyJpZCI6MjB9', pageSize: 20, hasNext: true }

// Page 2 — pass the cursor
const p2 = await userRepo.select({ isActive: true })
  .cursorPaginate({ pageSize: 20, cursorColumn: 'id', cursor: p1.nextCursor });

// Descending (newest first)
const latest = await userRepo.select()
  .cursorPaginate({ pageSize: 20, cursorColumn: 'createdAt', direction: 'desc' });
```

| | `paginate` | `cursorPaginate` |
|---|---|---|
| Total count | ✅ Yes | ❌ No |
| Page number navigation | ✅ Yes | ❌ Next/Prev only |
| Performance at row 1,000,000 | ❌ Slow | ✅ Constant speed |
| Best for | Admin tables, standard lists | Feeds, logs, large exports |

---

## Large Data Processing

### Batch processing (forEach)

Load 10 million rows without crashing your server. Processes in chunks, never holds everything in memory.

```ts
// Send email to every active user — without loading all users at once
await userRepo.select({ isActive: true })
  .orderBy([{ column: 'id', direction: 'ASC' }])
  .forEach(async (batch) => {
    await sendEmailBatch(batch);  // batch: User[] (200 rows at a time)
  }, { batchSize: 200 });
```

### Streaming (AsyncGenerator)

Row-by-row processing with `for await...of`. Perfect for real-time pipelines.

```ts
for await (const user of userRepo.select({ isActive: true })) {
  await processRow(user);  // one row at a time, low memory usage
}

// Custom batch size for internal fetching
for await (const user of userRepo.select().stream({ batchSize: 1000 })) {
  await writeToFile(user);
}
```

### EXPLAIN — query plan analysis

```ts
// Check if your index is being used
const plan = await userRepo.select({ isActive: true })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .explain(true);  // true = EXPLAIN ANALYZE (actually runs the query)

console.log(plan);
// Index Scan using users_created_at_idx on users ...
```

---

## Aggregate Functions

```ts
// Single aggregation
const result = await userRepo.select().calculate([{ fn: 'COUNT', alias: 'count' }]);
const total = parseInt(String(result.count), 10);  // → 1042

// Multiple aggregations with filter
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

When the query builder isn't enough, drop into raw SQL. You still get camelCase conversion.

```ts
// Via repository
const users = await userRepo.raw<{ id: number; orderCount: number }>(
  `SELECT u.id, COUNT(o.id) AS order_count
   FROM users u
   LEFT JOIN orders o ON u.id = o.user_id
   WHERE u.is_active = $1
   GROUP BY u.id`,
  [true],
);
// → [{ id: 1, orderCount: 5 }, ...]  ← order_count → orderCount automatically

// Standalone (no repository)
import { QueryBuilder } from 'reltype';

const rows = await QueryBuilder.raw(
  'SELECT * FROM users WHERE first_name ILIKE $1',
  ['%john%'],
);
```

---

## CRUD Methods

### create

```ts
const user = await userRepo.create({
  firstName: 'Alice',
  email:     'alice@example.com',
  // isActive, createdAt → optional (DB handles defaults)
});
// → User (full row returned via RETURNING *)
```

### update

```ts
// Only updates the fields you pass
const updated = await userRepo.update(1, {
  firstName: 'Alicia',
  isActive:  true,
});
// → User | null (null if ID not found)
```

### delete

```ts
const ok = await userRepo.delete(1);
// → true if deleted, false if not found
```

### upsert

```ts
// Conflict on primary key (default)
await userRepo.upsert({ id: 1, firstName: 'Bob', email: 'bob@example.com' });

// Conflict on another unique column
await userRepo.upsert(
  { firstName: 'Bob', email: 'bob@example.com' },
  'email',  // snake_case column name
);
```

### bulkCreate

```ts
const users = await userRepo.bulkCreate([
  { firstName: 'Alice', email: 'alice@example.com' },
  { firstName: 'Bob',   email: 'bob@example.com'   },
  { firstName: 'Carol', email: 'carol@example.com' },
]);
// → User[]  (single INSERT query, RETURNING *)
```

---

## Lifecycle Hooks

Monitor every query, integrate APM, or log slow queries — without touching your business logic.

### Per-query hooks

```ts
const users = await userRepo.select({ isActive: true })
  .hooks({
    beforeExec: ({ sql, params }) => {
      console.log('[SQL]', sql);
    },
    afterExec: ({ rows, elapsed }) => {
      if (elapsed > 500) console.warn('Slow query:', elapsed, 'ms');
      metrics.record('db.query.duration', elapsed);
    },
    onError: ({ err, sql }) => {
      alerting.send({ message: err.message, sql });
    },
  })
  .paginate({ page: 1, pageSize: 20 });
```

### Repository-level global hooks

Set once, applied to every `select()` on this repository automatically.

```ts
userRepo.useHooks({
  beforeExec: ({ sql }) => logger.debug('SQL:', sql),
  afterExec:  ({ elapsed }) => metrics.histogram('db.latency', elapsed),
  onError:    ({ err })   => logger.error('DB error', { kind: err.kind }),
});
```

---

## Error Handling

### DbError — structured PostgreSQL error classification

Every DB error is automatically wrapped in a `DbError`. It separates what's safe to show users from what stays in your logs.

```ts
import { DbError } from 'reltype';

try {
  await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });
} catch (err) {
  if (err instanceof DbError) {
    // ✅ Safe to send to the client
    res.status(409).json(err.toUserPayload());
    // → { error: 'A duplicate value already exists.', kind: 'uniqueViolation', isRetryable: false }

    // 🔒 Internal details — never expose these
    logger.error('db error', err.toLogContext());
    // → { pgCode: '23505', table: 'users', constraint: 'users_email_key', detail: '...' }

    // Retry logic for transient errors
    if (err.isRetryable) await retry(operation);
  }
}
```

### Express integration example

```ts
app.post('/users', async (req, res) => {
  try {
    const user = await userRepo.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof DbError) {
      const status =
        err.kind === 'uniqueViolation'   ? 409 :
        err.kind === 'notNullViolation'  ? 400 :
        err.kind === 'foreignKeyViolation' ? 422 :
        err.isRetryable                  ? 503 : 500;
      res.status(status).json(err.toUserPayload());
    } else {
      res.status(500).json({ error: 'Unexpected error.' });
    }
  }
});
```

### Error kind reference

| Kind | PostgreSQL Code | Description | isRetryable |
|---|---|---|---|
| `uniqueViolation` | 23505 | UNIQUE constraint violated | false |
| `foreignKeyViolation` | 23503 | FK constraint violated | false |
| `notNullViolation` | 23502 | NOT NULL constraint violated | false |
| `checkViolation` | 23514 | CHECK constraint violated | false |
| `deadlock` | 40P01 | Deadlock detected | **true** |
| `serializationFailure` | 40001 | Serialization failure | **true** |
| `connectionFailed` | 08xxx | Connection failure | **true** |
| `tooManyConnections` | 53300 | Pool exhausted | **true** |
| `queryTimeout` | 57014 | Query timed out | false |
| `undefinedTable` | 42P01 | Table not found | false |
| `undefinedColumn` | 42703 | Column not found | false |
| `invalidInput` | 22xxx | Invalid data format | false |
| `unknown` | other | Unclassified error | false |

---

## Transaction

```ts
import { runInTx } from 'reltype';

await runInTx(async (client) => {
  // Both operations run in the same transaction
  const user  = await userRepo.create({ firstName: 'Alice', email: 'alice@example.com' });
  const order = await orderRepo.create({ userId: user.id, total: 9900 });
  return { user, order };
});
// Automatically ROLLBACK if any operation throws
```

---

## Connection Pool

```ts
import { getPool, getPoolStatus, checkPoolHealth, closePool } from 'reltype';

// Real-time pool metrics
const status = getPoolStatus();
// {
//   isInitialized: true,
//   totalCount:    8,   ← total connections open
//   idleCount:     3,   ← ready to use
//   waitingCount:  0,   ← requests waiting (0 = healthy)
//   isHealthy:     true
// }

// Ping the DB server (SELECT 1)
const alive = await checkPoolHealth();  // → boolean

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
```

### Recommended pool configuration

```env
DB_MAX=10                  # Max connections (match your Postgres max_connections)
DB_CONNECTION_TIMEOUT=3000 # ⚠️  Must set — otherwise exhausted pool waits forever
DB_IDLE_TIMEOUT=30000      # Release idle connections after 30s
DB_STATEMENT_TIMEOUT=10000 # Kill runaway queries after 10s
```

> If `DB_CONNECTION_TIMEOUT` is not set, reltype will warn on startup. An exhausted pool will hang indefinitely without this value.

---

## PostgreSQL Schema Support

```ts
// Dot notation
const logsTable = defineTable('audit.activity_logs', { ... });

// Explicit option
const usersTable = defineTable('users', { ... }, { schema: 'auth' });

// → SQL: INSERT INTO "auth"."users" ...
// Identifiers are always quoted to avoid reserved word conflicts
```

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

### Modifiers

```ts
col.text().notNull()           // required on INSERT
col.text().nullable()          // optional on INSERT, allows NULL
col.integer().primaryKey()     // optional on INSERT, serial/auto
col.boolean().default()        // optional on INSERT (DB has a DEFAULT)
col.timestamptz().defaultNow() // optional on INSERT (DEFAULT NOW())
```

---

## Extending BaseRepo

Add domain-specific methods to your repository:

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

## Logging

```env
LOGGER=true          # Enable logging
LOG_LEVEL=debug      # debug | info | log | warn | error
LOG_FORMAT=json      # text (dev, colored) | json (prod, log collectors)
```

**Development output (`text` format):**
```
2026-01-01T00:00:00.000Z [Pool] INFO  Pool created { max: 10, connectionTimeoutMillis: 3000 }
2026-01-01T00:00:00.000Z [Repo] DEBUG SQL: SELECT * FROM users WHERE is_active = $1 [ true ]
2026-01-01T00:00:00.000Z [Repo] DEBUG Done (8ms) rowCount=42
```

**Production output (`json` format, for Datadog / CloudWatch / Grafana Loki):**
```json
{"ts":"2026-01-01T00:00:00.000Z","level":"INFO","prefix":"[Pool]","msg":"Pool created","meta":[{"max":10}]}
{"ts":"2026-01-01T00:00:00.000Z","level":"ERROR","prefix":"[Repo]","msg":"Query failed [users]","meta":[{"pgCode":"23505","kind":"uniqueViolation","constraint":"users_email_key"}]}
```

| Level | Prefix | When |
|---|---|---|
| INFO | [Pool] | Pool created / closed |
| WARN | [Pool] | No connectionTimeoutMillis / max connections reached |
| ERROR | [Pool] | Idle client error / connection acquisition failed |
| DEBUG | [Repo] | Every SQL + elapsed time |
| ERROR | [Repo] | Query failed (pgCode, kind, elapsed) |
| DEBUG | [Tx] | Transaction started / committed |
| WARN | [Tx] | Rollback |
| ERROR | [Tx] | Rollback failed |

---

## All Environment Variables

```env
# ── Connection ────────────────────────────────────────────────────────────────
DB_CONNECTION_STRING=             # postgresql://user:pass@host:5432/db (priority)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres

# ── Pool ──────────────────────────────────────────────────────────────────────
DB_MAX=10                         # Max pool size
DB_IDLE_TIMEOUT=30000             # Idle connection release (ms)
DB_CONNECTION_TIMEOUT=3000        # Max wait to acquire connection (ms) — ALWAYS SET THIS
DB_ALLOW_EXIT_ON_IDLE=false       # Allow process exit when pool is empty
DB_STATEMENT_TIMEOUT=0            # Max statement execution time (ms, 0 = unlimited)
DB_QUERY_TIMEOUT=0                # Max query time (ms, 0 = unlimited)
DB_SSL=false                      # Enable SSL
DB_KEEP_ALIVE=true                # TCP keep-alive
DB_KEEP_ALIVE_INITIAL_DELAY=10000 # Keep-alive initial delay (ms)
DB_APPLICATION_NAME=my-app        # Name visible in pg_stat_activity

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGER=true
LOG_LEVEL=info                    # debug | info | log | warn | error
LOG_FORMAT=text                   # text | json
```

---

## FAQ

**Q. Do I need to run migrations?**  
No. reltype does not manage your database schema. Use your preferred migration tool (Flyway, Liquibase, `psql`, etc.). reltype only generates and executes SQL queries.

**Q. Can I use it with an existing database?**  
Yes. Define your `defineTable(...)` to match your existing columns. reltype reads from whatever is in Postgres.

**Q. What if I have a very complex query?**  
Use `repo.raw(sql, params)` or `QueryBuilder.raw(sql, params)` for full SQL control. You still get camelCase conversion on results.

**Q. Can I use this with NestJS / Fastify / Koa?**  
Yes. reltype is framework-agnostic. It only depends on `pg`.

**Q. Is it safe against SQL injection?**  
All values in `where`, `create`, `update`, etc. are passed as parameterized queries (`$1`, `$2`, ...). Never string-interpolated. The only surface to be careful about is the `on` clause in `.join()` — always construct that from static strings in your code.

**Q. How is it different from Drizzle ORM?**  
Both are TypeScript-first and lightweight. reltype's key advantages are automatic camelCase↔snake_case conversion (Drizzle requires manual column naming), built-in cursor pagination, streaming, and batch processing out of the box, and a structured `DbError` system with user-safe messages.

---

## Architecture

```
reltype/
├── index.ts                        ← Public API
├── configs/env.ts                  ← DB config helper
├── utils/
│   ├── logger.ts                   ← Logger (text/json format)
│   ├── dbError.ts                  ← DbError classification
│   └── reader.ts                   ← Env parser, PostgresConfig
└── features/
    ├── schema/                     ← defineTable, col, InferRow/Insert/Update
    ├── transform/                  ← camelCase ↔ snake_case
    ├── connection/                 ← Pool, withClient, runInTx
    ├── query/                      ← QueryBuilder, build* functions
    └── repository/                 ← BaseRepo, createRepo
```

---

## Contributing

Bug reports, feature ideas, and PRs are very welcome.

→ [Open an Issue](https://github.com/psh-suhyun/reltype/issues)  
→ [Submit a PR](https://github.com/psh-suhyun/reltype/pulls)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

---

## License

MIT © [psh-suhyun](https://github.com/psh-suhyun)
