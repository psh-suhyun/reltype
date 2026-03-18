import { PoolClient } from 'pg';
import { TableDef, Cols } from '../schema/interfaces/Table';
import { InferRow, InferInsert, InferUpdate } from '../schema/interfaces/Infer';
import { buildSelect } from '../query/select';
import { buildInsert } from '../query/insert';
import { buildUpdate } from '../query/update';
import { buildDelete } from '../query/delete';
import { buildUpsert } from '../query/upsert';
import { buildBulkInsert } from '../query/bulkInsert';
import { BuiltQuery } from '../query/interfaces/Query';
import { QueryBuilder } from '../query/builder';
import { AdvancedWhere, ExecHooks } from '../query/interfaces/Advanced';
import { mapRows } from '../transform/mapper';
import { toSnake } from '../transform/case';
import { withClient } from '../connection/pool';
import { Logger } from '../../utils/logger';
import { DbError } from '../../utils/dbError';
import { IRepo } from './interfaces/Repo';
import { FindOpts } from './interfaces/Find';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Repo]' },
);

/** 런타임에서 primary key의 camelCase 키를 찾습니다. */
function findPkKey(cols: Cols): string {
  const entry = Object.entries(cols).find(([, c]) => c.isPrimary);
  return entry ? entry[0] : 'id';
}

/**
 * 기본 CRUD 레포지토리.
 *
 * - 모든 DB 에러는 `DbError`로 변환됩니다.
 * - 사용자에게 노출할 메시지는 `DbError.toUserPayload()`를 사용하세요.
 * - 트랜잭션 내에서 사용하려면 `exec(built, client)` 형태로 client를 전달하세요.
 */
export class BaseRepo<TDef extends TableDef<string, Cols>>
  implements IRepo<InferRow<TDef>, InferInsert<TDef>, InferUpdate<TDef>>
{
  protected readonly tableName: string;
  protected readonly pkKey: string;
  protected readonly pkCol: string;

  private _globalHooks?: ExecHooks<InferRow<TDef>>;

  constructor(protected readonly def: TDef) {
    this.tableName = def.name;
    this.pkKey     = findPkKey(def.cols);
    this.pkCol     = toSnake(this.pkKey);
  }

  /**
   * 이 레포지토리의 모든 `select()` 빌더에 적용될 글로벌 훅을 등록합니다.
   *
   * @example
   * ```ts
   * userRepo.useHooks({
   *   beforeExec: ({ sql }) => logger.debug('SQL:', sql),
   *   afterExec:  ({ elapsed }) => metrics.record('db.query', elapsed),
   * });
   * ```
   */
  useHooks(h: ExecHooks<InferRow<TDef>>): this {
    this._globalHooks = h;
    return this;
  }

  /**
   * SQL을 실행하고 camelCase 변환된 rows를 반환합니다.
   *
   * - 에러 발생 시 `DbError`로 변환 후 로깅하고 re-throw합니다.
   * - `client`를 넘기면 해당 client를 재사용합니다 (트랜잭션 지원).
   */
  protected async exec<T extends Record<string, unknown>>(
    built: BuiltQuery,
    client?: PoolClient,
  ): Promise<T[]> {
    const run = async (c: PoolClient): Promise<T[]> => {
      const start = Date.now();
      logger.debug(`SQL: ${built.sql}`, built.params);

      try {
        const result = await c.query(built.sql, built.params as unknown[]);
        logger.debug(`완료 (${Date.now() - start}ms) rowCount=${result.rowCount ?? 0}`);
        return mapRows<T>(result.rows as Record<string, unknown>[]);
      } catch (err) {
        const dbErr = DbError.from(err);
        logger.error(`쿼리 실패 [${this.tableName}]`, {
          ...dbErr.toLogContext(),
          sql:     built.sql,
          elapsed: `${Date.now() - start}ms`,
        });
        throw dbErr;
      }
    };

    if (client) return run(client);
    return withClient(run);
  }

  async findAll(opts: FindOpts<InferRow<TDef>> = {}): Promise<InferRow<TDef>[]> {
    try {
      return await this.exec<InferRow<TDef>>(
        buildSelect<InferRow<TDef>>(this.tableName, opts),
      );
    } catch (err) {
      throw DbError.from(err);
    }
  }

  async findById(id: number | string): Promise<InferRow<TDef> | null> {
    try {
      const rows = await this.exec<InferRow<TDef>>(
        buildSelect<InferRow<TDef>>(this.tableName, {
          where: { [this.pkKey]: id } as Partial<InferRow<TDef>>,
          limit: 1,
        }),
      );
      return rows[0] ?? null;
    } catch (err) {
      throw DbError.from(err);
    }
  }

  async findOne(where: Partial<InferRow<TDef>>): Promise<InferRow<TDef> | null> {
    try {
      const rows = await this.exec<InferRow<TDef>>(
        buildSelect<InferRow<TDef>>(this.tableName, { where, limit: 1 }),
      );
      return rows[0] ?? null;
    } catch (err) {
      throw DbError.from(err);
    }
  }

  async create(data: InferInsert<TDef>): Promise<InferRow<TDef>> {
    try {
      const rows = await this.exec<InferRow<TDef>>(
        buildInsert(this.tableName, data as Record<string, unknown>),
      );
      return rows[0];
    } catch (err) {
      throw DbError.from(err);
    }
  }

  async update(
    id: number | string,
    data: InferUpdate<TDef>,
  ): Promise<InferRow<TDef> | null> {
    try {
      const where = { [this.pkKey]: id } as Partial<InferRow<TDef>>;
      const rows  = await this.exec<InferRow<TDef>>(
        buildUpdate(
          this.tableName,
          data as Record<string, unknown>,
          where as Record<string, unknown>,
        ),
      );
      return rows[0] ?? null;
    } catch (err) {
      throw DbError.from(err);
    }
  }

  async delete(id: number | string): Promise<boolean> {
    try {
      const where = { [this.pkKey]: id } as Partial<InferRow<TDef>>;
      const built = buildDelete(this.tableName, where);

      return await withClient(async (client) => {
        const start = Date.now();
        logger.debug(`SQL: ${built.sql}`, built.params);

        try {
          const result = await client.query(built.sql, built.params as unknown[]);
          logger.debug(`완료 (${Date.now() - start}ms)`);
          return (result.rowCount ?? 0) > 0;
        } catch (err) {
          const dbErr = DbError.from(err);
          logger.error(`삭제 실패 [${this.tableName}]`, {
            ...dbErr.toLogContext(),
            elapsed: `${Date.now() - start}ms`,
          });
          throw dbErr;
        }
      });
    } catch (err) {
      throw DbError.from(err);
    }
  }

  /**
   * 데이터를 삽입하거나, 충돌 시 UPDATE합니다.
   * @param conflictCol - 충돌 기준 컬럼 (snake_case, 기본값: primary key)
   */
  async upsert(
    data: InferInsert<TDef>,
    conflictCol?: string,
  ): Promise<InferRow<TDef>> {
    try {
      const rows = await this.exec<InferRow<TDef>>(
        buildUpsert(
          this.tableName,
          data as Record<string, unknown>,
          conflictCol ?? this.pkCol,
        ),
      );
      return rows[0];
    } catch (err) {
      throw DbError.from(err);
    }
  }

  /**
   * 여러 row를 단일 INSERT 쿼리로 삽입합니다.
   */
  async bulkCreate(rows: InferInsert<TDef>[]): Promise<InferRow<TDef>[]> {
    try {
      return await this.exec<InferRow<TDef>>(
        buildBulkInsert(
          this.tableName,
          rows as Record<string, unknown>[],
        ),
      );
    } catch (err) {
      throw DbError.from(err);
    }
  }

  // ── Fluent QueryBuilder ────────────────────────────────────────────────────

  /**
   * 유연한 플루언트 쿼리 빌더를 반환합니다.
   *
   * WHERE, OR, ORDER BY, GROUP BY, JOIN, LIMIT, OFFSET, paginate, calculate 등을
   * 메서드 체인으로 조합할 수 있습니다.
   *
   * @example
   * ```ts
   * // 기본 조회 (await 직접 사용 가능)
   * const users = await repo.select({ isActive: true })
   *   .orderBy([{ column: 'createdAt', direction: 'DESC' }])
   *   .limit(20);
   *
   * // OR 조건
   * const results = await repo.select()
   *   .or({ email: { operator: 'LIKE', value: '%@gmail.com' } });
   *
   * // 페이지네이션
   * const page = await repo.select()
   *   .paginate({ page: 1, pageSize: 20 });
   *
   * // 집계
   * const agg = await repo.select({ isActive: true })
   *   .calculate([{ fn: 'COUNT', alias: 'count' }]);
   * ```
   */
  select(where?: AdvancedWhere<InferRow<TDef>>): QueryBuilder<InferRow<TDef>> {
    const qb = new QueryBuilder<InferRow<TDef>>(this.tableName, where);
    if (this._globalHooks) qb.hooks(this._globalHooks);
    return qb;
  }

  /**
   * 단건 조회 (없으면 null). `select(where).one()` 의 단축형입니다.
   *
   * @example
   * ```ts
   * const user = await repo.selectOne({ id: 1 });
   * ```
   */
  async selectOne(
    where: AdvancedWhere<InferRow<TDef>>,
  ): Promise<InferRow<TDef> | null> {
    try {
      return await new QueryBuilder<InferRow<TDef>>(this.tableName, where).one();
    } catch (err) {
      throw DbError.from(err);
    }
  }

  /**
   * Raw SQL을 직접 실행합니다.
   * DB 컬럼명(snake_case) → TypeScript(camelCase) 자동 변환이 적용됩니다.
   *
   * @example
   * ```ts
   * const rows = await repo.raw<UserRow>(
   *   'SELECT * FROM users WHERE first_name ILIKE $1',
   *   ['%john%'],
   * );
   * ```
   */
  async raw<R extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<R[]> {
    return QueryBuilder.raw<R>(sql, params);
  }
}
