// ── Schema ──────────────────────────────────────────────────────────────────
export { col, Col }          from './features/schema/column';
export { defineTable }       from './features/schema/table';
export type { TableOpts }    from './features/schema/table';
export type { ColShape }     from './features/schema/interfaces/Column';
export type { TableDef, Cols } from './features/schema/interfaces/Table';
export type { InferRow, InferInsert, InferUpdate } from './features/schema/interfaces/Infer';

// ── Repository ───────────────────────────────────────────────────────────────
export { createRepo }        from './features/repository/create';
export { BaseRepo }          from './features/repository/base';
export type { IRepo }        from './features/repository/interfaces/Repo';
export type { FindOpts }     from './features/repository/interfaces/Find';

// ── Connection ───────────────────────────────────────────────────────────────
export { getPool, withClient, closePool, getPoolStatus, checkPoolHealth } from './features/connection/pool';
export type { PoolStatus }   from './features/connection/pool';
export { runInTx }           from './features/connection/tx';

// ── Query builders ───────────────────────────────────────────────────────────
export { buildSelect }       from './features/query/select';
export { buildInsert }       from './features/query/insert';
export { buildUpdate }       from './features/query/update';
export { buildDelete }       from './features/query/delete';
export { buildUpsert }       from './features/query/upsert';
export { buildBulkInsert }   from './features/query/bulkInsert';
export { buildWhere }        from './features/query/where';
export type { BuiltQuery }   from './features/query/interfaces/Query';
export type { WhereInput }   from './features/query/interfaces/Where';
export type { OrderByInput, OrderDir } from './features/query/interfaces/Order';
export type { SelectOpts }   from './features/query/select';

// ── Fluent QueryBuilder ───────────────────────────────────────────────────────
export { QueryBuilder }      from './features/query/builder';
export type {
  AdvancedWhere,
  WhereOp,
  WhereVal,
  JoinClause,
  JoinType,
  AggregateFn,
  AggregateCalc,
  PaginateOpts,
  PageResult,
  OrderByClause,
  KeysetPaginateOpts,
  KeysetPageResult,
  StreamOpts,
  ExecHooks,
} from './features/query/interfaces/Advanced';

// ── Transform ────────────────────────────────────────────────────────────────
export { toCamel, toSnake, keysToCamel, keysToSnake } from './features/transform/case';
export { mapRow, mapRows }   from './features/transform/mapper';

// ── Error handling ───────────────────────────────────────────────────────────
export { DbError }           from './utils/dbError';
export type { DbErrorKind, DbErrorPayload } from './utils/dbError';

// ── Config ───────────────────────────────────────────────────────────────────
export { getDatabaseConfig } from './configs/env';
export type { DatabaseConfig } from './interfaces/DatabaseConfig';
export { PostgresConfig, NodeEnvSource, readEnv } from './utils/reader';

// ── Logger ───────────────────────────────────────────────────────────────────
export { Logger }            from './utils/logger';
export type { LogLevel, LogFormat, LoggerConfig } from './utils/logger';

// ── SQL Guard (SQL Injection 방어 유틸리티) ───────────────────────────────────
export {
  quoteIdentifier,
  escapeSchemaIdentifier,
  validateOrderDir,
  validateAggregateFn,
  validateJoinType,
} from './utils/sqlGuard';
