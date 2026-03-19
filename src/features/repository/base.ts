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

/**
 * `BaseRepo` 생성자 옵션.
 *
 * @example
 * ```ts
 * // 생성 시 debug 활성화
 * const userRepo = new UserRepo(usersTable, { debug: true });
 *
 * // 런타임 토글
 * userRepo.debugMode(true);   // 활성화
 * userRepo.debugMode(false);  // 비활성화
 * ```
 */
export interface RepoOpts {
  /**
   * `true` 로 설정하면 이 레포지토리의 모든 SQL 실행 내용을 콘솔에 강제 출력합니다.
   *
   * - `LOG_LEVEL` 환경변수 설정과 무관하게 항상 출력됩니다.
   * - 출력 내용: SQL 쿼리, 파라미터, 실행 시간, 반환 row 수
   * - 개발·디버깅 목적으로만 사용하세요. 프로덕션에서는 `false` 유지를 권장합니다.
   */
  debug?: boolean;
}

/**
 * 런타임에서 primary key의 camelCase 키를 찾습니다.
 * primary key가 없으면 경고를 출력하고 'id'를 기본값으로 사용합니다.
 */
function findPkKey(cols: Cols, tableName: string): string {
  const entry = Object.entries(cols).find(([, c]) => c.isPrimary);
  if (!entry) {
    logger.warn(
      `[Repo] '${tableName}' 테이블에 primary key가 정의되지 않았습니다. ` +
      `findById, delete 등에서 'id' 컬럼을 기본값으로 사용합니다. ` +
      `col.xxx().primaryKey() 로 명시적으로 지정하세요.`,
    );
    return 'id';
  }
  return entry[0];
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
  private _debugMode: boolean;

  /** debug 전용 Logger — LOG_LEVEL 환경변수와 무관하게 항상 출력 */
  private readonly _debugLogger: Logger;

  constructor(protected readonly def: TDef, opts?: RepoOpts) {
    this.tableName  = def.qualifiedName ?? def.name;
    this.pkKey      = findPkKey(def.cols, this.tableName);
    this.pkCol      = toSnake(this.pkKey);
    this._debugMode = opts?.debug ?? false;
    this._debugLogger = new Logger({
      enabled:         true,
      level:           'debug',
      format:          'text',
      enableTimestamp: false,
      prefix:          `[SQL ${this.tableName}]`,
    });
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
   * 쿼리 디버그 모드를 런타임에 토글합니다.
   * `true` 이면 이 레포지토리의 모든 SQL 실행 내용을 콘솔에 강제 출력합니다.
   *
   * @example
   * ```ts
   * userRepo.debugMode(true);  // 활성화
   * userRepo.debugMode(false); // 비활성화
   * userRepo.debugMode();      // 인수 생략 시 true (toggle-on)
   * ```
   */
  debugMode(enabled: boolean = true): this {
    this._debugMode = enabled;
    return this;
  }

  /**
   * 현재 debug 모드 활성화 여부를 반환합니다.
   */
  get isDebugMode(): boolean {
    return this._debugMode;
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
    if (!built.sql) {
      logger.error(`[${this.tableName}] 빈 SQL이 전달되었습니다. 실행을 건너뜁니다.`);
      return [];
    }

    const run = async (c: PoolClient): Promise<T[]> => {
      const start = Date.now();

      if (this._debugMode) {
        this._debugLogger.debug(`SQL:    ${built.sql}`);
        if (built.params.length > 0) {
          this._debugLogger.debug('Params:', built.params);
        }
      } else {
        logger.debug(`SQL: ${built.sql}`, built.params);
      }

      try {
        const result  = await c.query(built.sql, built.params as unknown[]);
        const elapsed = Date.now() - start;
        const count   = result.rowCount ?? 0;

        if (this._debugMode) {
          this._debugLogger.debug(`→ ${count} rows in ${elapsed}ms`);
        } else {
          logger.debug(`완료 (${elapsed}ms) rowCount=${count}`);
        }

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

  /**
   * ID로 단건 삭제합니다.
   * `exec()`를 재사용하여 로깅과 에러 처리를 일관성 있게 처리합니다.
   */
  async delete(id: number | string): Promise<boolean> {
    try {
      const where = { [this.pkKey]: id } as Partial<InferRow<TDef>>;
      const rows  = await this.exec<InferRow<TDef>>(
        buildDelete(this.tableName, where),
      );
      return rows.length > 0;
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
   *
   * @throws rows가 빈 배열이면 Error를 던집니다.
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
   * 전역 훅(`useHooks`)이 설정된 경우 빌더에 자동으로 주입됩니다.
   *
   * @example
   * ```ts
   * const users = await repo.select({ isActive: true })
   *   .orderBy([{ column: 'createdAt', direction: 'DESC' }])
   *   .limit(20);
   *
   * const page = await repo.select()
   *   .paginate({ page: 1, pageSize: 20 });
   * ```
   */
  select(where?: AdvancedWhere<InferRow<TDef>>): QueryBuilder<InferRow<TDef>> {
    const qb = new QueryBuilder<InferRow<TDef>>(this.tableName, where);
    const composedHooks = this.buildSelectHooks();
    if (composedHooks) qb.hooks(composedHooks);
    return qb;
  }

  /**
   * debug 훅과 전역 훅을 합성합니다.
   * - debugMode ON:  debug 출력 → _globalHooks 순서로 실행
   * - debugMode OFF: _globalHooks 만 실행
   */
  private buildSelectHooks(): ExecHooks<InferRow<TDef>> | undefined {
    if (!this._debugMode && !this._globalHooks) return undefined;
    if (!this._debugMode) return this._globalHooks;

    const dl = this._debugLogger;
    const g  = this._globalHooks;

    return {
      beforeExec: async (ctx) => {
        dl.debug(`SQL:    ${ctx.sql}`);
        if (ctx.params.length > 0) dl.debug('Params:', ctx.params);
        await g?.beforeExec?.(ctx);
      },
      afterExec: async (ctx) => {
        dl.debug(`→ ${ctx.rows.length} rows in ${ctx.elapsed}ms`);
        await g?.afterExec?.(ctx);
      },
      onError: g?.onError,
    };
  }

  /**
   * 단건 조회 (없으면 null). `select(where).one()` 의 단축형입니다.
   * 전역 훅이 적용됩니다.
   *
   * @example
   * ```ts
   * const user = await repo.selectOne({ id: 1 });
   * const user = await repo.selectOne({ email: 'foo@bar.com' });
   * ```
   */
  async selectOne(
    where: AdvancedWhere<InferRow<TDef>>,
  ): Promise<InferRow<TDef> | null> {
    try {
      return await this.select(where).one();
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
