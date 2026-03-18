import { withClient } from '../connection/pool';
import { mapRows } from '../transform/mapper';
import { toSnake } from '../transform/case';
import { Logger } from '../../utils/logger';
import { DbError } from '../../utils/dbError';
import {
  AdvancedWhere,
  WhereVal,
  JoinClause,
  AggregateCalc,
  PaginateOpts,
  PageResult,
  OrderByClause,
  RawCond,
  KeysetPaginateOpts,
  KeysetPageResult,
  StreamOpts,
  ExecHooks,
} from './interfaces/Advanced';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Query]' },
);

// ── 내부 유틸 ──────────────────────────────────────────────────────────────

function isWhereVal(val: unknown): val is WhereVal<unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    'operator' in (val as object)
  );
}

function parseWhere<T extends Record<string, unknown>>(
  where: AdvancedWhere<T>,
): RawCond[] {
  const conds: RawCond[] = [];

  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    const col = toSnake(key);

    if (val === null) {
      conds.push({ col, op: 'IS NULL' });
    } else if (isWhereVal(val)) {
      conds.push({ col, op: val.operator, val: val.value });
    } else {
      conds.push({ col, op: '=', val });
    }
  }

  return conds;
}

function renderCond(c: RawCond, params: unknown[]): string {
  switch (c.op) {
    case 'IS NULL':
    case 'IS NOT NULL':
      return `${c.col} ${c.op}`;

    case 'IN':
    case 'NOT IN': {
      const arr = Array.isArray(c.val) ? c.val : [c.val];
      const phs = arr.map((v) => { params.push(v); return `$${params.length}`; });
      return `${c.col} ${c.op} (${phs.join(', ')})`;
    }

    default:
      params.push(c.val);
      return `${c.col} ${c.op} $${params.length}`;
  }
}

// ── QueryBuilder ────────────────────────────────────────────────────────────

/**
 * 플루언트 쿼리 빌더.
 *
 * ### 기본 사용
 * ```ts
 * const users = await repo.select({ isActive: true })
 *   .or({ email: { operator: 'ILIKE', value: '%@gmail.com' } })
 *   .orderBy([{ column: 'createdAt', direction: 'DESC' }])
 *   .limit(20);
 * ```
 *
 * ### 페이지네이션 (OFFSET 방식)
 * ```ts
 * const page = await repo.select().paginate({ page: 1, pageSize: 20 });
 * ```
 *
 * ### 커서 기반 페이지네이션 (대용량 최적화)
 * ```ts
 * const p1 = await repo.select().cursorPaginate({ pageSize: 20, cursorColumn: 'id' });
 * const p2 = await repo.select().cursorPaginate({ pageSize: 20, cursorColumn: 'id', cursor: p1.nextCursor });
 * ```
 *
 * ### 스트리밍 (메모리 효율)
 * ```ts
 * for await (const user of repo.select().stream()) {
 *   await processRow(user);
 * }
 * ```
 *
 * ### 배치 처리
 * ```ts
 * await repo.select().forEach(async (batch) => {
 *   await processBatch(batch);
 * }, { batchSize: 500 });
 * ```
 *
 * ### 훅
 * ```ts
 * repo.select()
 *   .hooks({ beforeExec: ({ sql }) => console.log(sql) })
 *   .exec();
 * ```
 */
export class QueryBuilder<T extends Record<string, unknown>> {
  private readonly _table: string;
  private _andConds: RawCond[]  = [];
  private _orConds:  RawCond[]  = [];
  private _orderByClauses: Array<{ col: string; dir: 'ASC' | 'DESC' }> = [];
  private _limitVal?: number;
  private _offsetVal?: number;
  private _groupByCols: string[]  = [];
  private _joins: JoinClause[]    = [];
  private _cols = '*';
  private _execHooks?: ExecHooks<T>;

  constructor(table: string, initWhere?: AdvancedWhere<T>) {
    this._table = table;
    if (initWhere) {
      this._andConds = parseWhere(initWhere);
    }
  }

  // ── Chain methods ──────────────────────────────────────────────────────────

  /** AND 조건 추가 */
  where(conditions: AdvancedWhere<T>): this {
    this._andConds.push(...parseWhere(conditions));
    return this;
  }

  /** OR 조건 추가 */
  or(conditions: AdvancedWhere<T>): this {
    this._orConds.push(...parseWhere(conditions));
    return this;
  }

  /**
   * ORDER BY 설정
   * @example .orderBy([{ column: 'createdAt', direction: 'DESC' }])
   */
  orderBy(clauses: OrderByClause<T>[]): this {
    this._orderByClauses = clauses.map(({ column, direction }) => ({
      col: toSnake(String(column)),
      dir: direction ?? 'ASC',
    }));
    return this;
  }

  limit(n: number): this {
    this._limitVal = n;
    return this;
  }

  offset(n: number): this {
    this._offsetVal = n;
    return this;
  }

  /**
   * GROUP BY 설정
   * @example .groupBy(['status', 'isActive'])
   */
  groupBy(columns: Array<keyof T | string>): this {
    this._groupByCols = columns.map((c) => toSnake(String(c)));
    return this;
  }

  /**
   * JOIN 추가 (여러 번 호출 가능)
   * @example
   * .join({ table: 'orders', on: 'users.id = orders.user_id', type: 'LEFT' })
   */
  join(j: JoinClause): this {
    this._joins.push(j);
    return this;
  }

  /**
   * SELECT 할 컬럼 지정 (기본값: *)
   * @example .columns(['id', 'email', 'firstName'])
   */
  columns(cols: Array<keyof T | string>): this {
    this._cols = cols.map((c) => toSnake(String(c))).join(', ');
    return this;
  }

  /**
   * 쿼리 실행 라이프사이클 훅을 등록합니다.
   *
   * @example
   * ```ts
   * repo.select()
   *   .hooks({
   *     beforeExec: ({ sql }) => logger.debug('SQL:', sql),
   *     afterExec:  ({ elapsed }) => metrics.record(elapsed),
   *     onError:    ({ err }) => alerting.notify(err),
   *   })
   *   .exec();
   * ```
   */
  hooks(h: ExecHooks<T>): this {
    this._execHooks = h;
    return this;
  }

  // ── Terminal async methods ─────────────────────────────────────────────────

  /**
   * 쿼리를 실행하고 rows 배열을 반환합니다.
   * `await builder` 와 동일합니다.
   */
  async exec(): Promise<T[]> {
    const { sql, params } = this.buildSelectSQL();
    return this.runQuery(sql, params);
  }

  /**
   * 첫 번째 row 하나를 반환합니다. 없으면 null입니다.
   */
  async one(): Promise<T | null> {
    const saved = this._limitVal;
    this._limitVal = 1;
    try {
      const rows = await this.exec();
      return rows[0] ?? null;
    } finally {
      this._limitVal = saved;
    }
  }

  /**
   * 집계 함수를 실행합니다.
   *
   * @example
   * ```ts
   * const result = await repo.select({ isActive: true })
   *   .calculate([
   *     { fn: 'COUNT', alias: 'count' },
   *     { fn: 'AVG', column: 'price', alias: 'avgPrice' },
   *   ]);
   * // → { count: '5', avgPrice: '12000.00' }
   * ```
   */
  async calculate(fns: AggregateCalc[]): Promise<Record<string, unknown>> {
    const { whereSQL, params } = this.buildWhereParts();
    const selects = fns
      .map(({ fn, column, alias }) => `${fn}(${column ?? '*'}) AS ${alias}`)
      .join(', ');

    const sql = [
      `SELECT ${selects}`,
      `FROM ${this._table}`,
      ...this._joins.map((j) => `${j.type ?? 'INNER'} JOIN ${j.table} ON ${j.on}`),
      whereSQL,
      this._groupByCols.length > 0 ? `GROUP BY ${this._groupByCols.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const rows = await this.runQuery<Record<string, unknown>>(sql, params);
    return rows[0] ?? {};
  }

  /**
   * OFFSET 기반 페이지네이션.
   * COUNT + DATA 쿼리를 병렬로 실행합니다.
   *
   * > 수백만 건 이상의 테이블에서는 `cursorPaginate()`를 사용하세요.
   *
   * @example
   * ```ts
   * const result = await repo.select()
   *   .paginate({ page: 1, pageSize: 20 });
   * // → { data, count, page, pageSize, nextAction, previousAction }
   * ```
   */
  async paginate(opts: PaginateOpts): Promise<PageResult<T>> {
    const { page, pageSize } = opts;
    const { whereSQL, params: whereParams } = this.buildWhereParts();

    const joinSQL  = this.buildJoinSQL();
    const groupSQL = this.buildGroupBySQL();
    const orderSQL = this.buildOrderBySQL();

    const countSql = [
      `SELECT COUNT(*) AS count FROM ${this._table}`,
      joinSQL, whereSQL, groupSQL,
    ].filter(Boolean).join(' ');

    const dataParams = [...whereParams];
    dataParams.push(pageSize);
    const limitIdx  = dataParams.length;
    dataParams.push((page - 1) * pageSize);
    const offsetIdx = dataParams.length;

    const dataSql = [
      `SELECT ${this._cols} FROM ${this._table}`,
      joinSQL, whereSQL, groupSQL, orderSQL,
      `LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    ].filter(Boolean).join(' ');

    try {
      return await withClient(async (client) => {
        if (this._execHooks?.beforeExec) {
          await this._execHooks.beforeExec({ sql: dataSql, params: dataParams });
        }

        const start = Date.now();
        logger.debug(`COUNT SQL: ${countSql}`, whereParams);
        logger.debug(`DATA  SQL: ${dataSql}`, dataParams);

        const [countResult, dataResult] = await Promise.all([
          client.query(countSql, whereParams),
          client.query(dataSql, dataParams),
        ]);

        const total = parseInt(
          String((countResult.rows[0] as Record<string, unknown>).count ?? '0'),
          10,
        );
        const data = mapRows<T>(dataResult.rows as Record<string, unknown>[]);

        if (this._execHooks?.afterExec) {
          await this._execHooks.afterExec({ rows: data, elapsed: Date.now() - start, sql: dataSql });
        }

        return {
          data,
          count:          total,
          page,
          pageSize,
          nextAction:     page * pageSize < total,
          previousAction: page > 1,
        };
      });
    } catch (err) {
      const dbErr = DbError.from(err);
      if (this._execHooks?.onError) {
        await this._execHooks.onError({ err: dbErr, sql: dataSql, params: dataParams });
      }
      throw dbErr;
    }
  }

  /**
   * 커서(Keyset) 기반 페이지네이션.
   *
   * OFFSET 스캔 없이 `WHERE cursor_col > last_value` 방식으로 동작하므로
   * 수천만 건 규모에서도 일정한 응답 속도를 보장합니다.
   *
   * - `cursorColumn`에는 반드시 인덱스가 존재해야 합니다.
   * - 결과는 항상 `cursorColumn` 기준으로 정렬됩니다.
   *
   * @example
   * ```ts
   * // 첫 페이지
   * const p1 = await repo.select({ isActive: true })
   *   .cursorPaginate({ pageSize: 20, cursorColumn: 'id' });
   *
   * // 다음 페이지
   * if (p1.hasNext) {
   *   const p2 = await repo.select({ isActive: true })
   *     .cursorPaginate({ pageSize: 20, cursorColumn: 'id', cursor: p1.nextCursor });
   * }
   * ```
   */
  async cursorPaginate(opts: KeysetPaginateOpts): Promise<KeysetPageResult<T>> {
    const { pageSize, cursor, cursorColumn, direction = 'asc' } = opts;
    const colSnake = toSnake(cursorColumn);

    // 커서 값 디코딩
    let cursorValue: unknown | undefined;
    if (cursor) {
      try {
        cursorValue = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      } catch {
        throw new Error(`유효하지 않은 cursor 값입니다: ${cursor}`);
      }
    }

    // 기존 조건에 커서 조건 추가 (원본 builder를 변경하지 않음)
    const qb = this.clone();
    if (cursorValue !== undefined) {
      qb._andConds.push({
        col: colSnake,
        op:  direction === 'asc' ? '>' : '<',
        val: cursorValue,
      });
    }

    // pageSize + 1개를 조회하여 다음 페이지 존재 여부 확인
    qb._orderByClauses = [{ col: colSnake, dir: direction === 'asc' ? 'ASC' : 'DESC' }];
    qb._limitVal       = pageSize + 1;

    const rows = await qb.exec();
    const hasNext = rows.length > pageSize;
    const data    = hasNext ? rows.slice(0, pageSize) : rows;

    // 다음 커서 인코딩 (마지막 row의 cursorColumn 값)
    let nextCursor: string | null = null;
    if (hasNext && data.length > 0) {
      const lastRow  = data[data.length - 1];
      const cursorVal = lastRow[cursorColumn as keyof T];
      nextCursor = Buffer.from(JSON.stringify(cursorVal)).toString('base64url');
    }

    return { data, nextCursor, pageSize, hasNext };
  }

  /**
   * 결과를 배치 단위로 처리합니다. 전체 데이터를 메모리에 올리지 않습니다.
   *
   * 대용량 테이블의 일괄 처리(ETL, 이메일 발송, 마이그레이션 등)에 적합합니다.
   *
   * @param fn        - 배치 배열을 받아 처리하는 비동기 함수
   * @param opts.batchSize - 한 번에 처리할 row 수 (기본값: 500)
   *
   * @example
   * ```ts
   * await repo.select({ isActive: true })
   *   .orderBy([{ column: 'id', direction: 'ASC' }])
   *   .forEach(async (batch) => {
   *     await sendEmailBatch(batch);
   *   }, { batchSize: 200 });
   * ```
   */
  async forEach(
    fn: (batch: T[]) => Promise<void>,
    opts?: StreamOpts,
  ): Promise<void> {
    const batchSize = opts?.batchSize ?? 500;
    const maxRows   = this._limitVal;
    let offset      = this._offsetVal ?? 0;
    let processed   = 0;

    while (true) {
      const remaining = maxRows !== undefined ? maxRows - processed : undefined;
      if (remaining !== undefined && remaining <= 0) break;

      const limit = remaining !== undefined
        ? Math.min(batchSize, remaining)
        : batchSize;

      const batch = await this.clone().limit(limit).offset(offset).exec();
      if (batch.length === 0) break;

      await fn(batch);

      processed += batch.length;
      offset    += batch.length;

      if (batch.length < limit) break;
    }
  }

  /**
   * AsyncGenerator로 row를 하나씩 yield합니다.
   * 내부적으로 배치 단위로 DB를 조회하여 메모리 효율을 유지합니다.
   *
   * @param opts.batchSize - 내부 배치 크기 (기본값: 500)
   *
   * @example
   * ```ts
   * for await (const user of repo.select({ isActive: true }).stream()) {
   *   await processRow(user);
   * }
   * ```
   */
  async *stream(opts?: StreamOpts): AsyncGenerator<T, void, unknown> {
    const batchSize = opts?.batchSize ?? 500;
    const maxRows   = this._limitVal;
    let offset      = this._offsetVal ?? 0;
    let yielded     = 0;

    while (true) {
      const remaining = maxRows !== undefined ? maxRows - yielded : undefined;
      if (remaining !== undefined && remaining <= 0) break;

      const limit = remaining !== undefined
        ? Math.min(batchSize, remaining)
        : batchSize;

      const batch = await this.clone().limit(limit).offset(offset).exec();
      if (batch.length === 0) break;

      for (const row of batch) {
        yield row;
        yielded++;
      }

      offset += batch.length;
      if (batch.length < limit) break;
    }
  }

  /**
   * `for await...of` 직접 사용을 지원합니다. `.stream()` 과 동일합니다.
   *
   * @example
   * ```ts
   * for await (const user of repo.select()) {
   *   // 각 row를 순서대로 처리
   * }
   * ```
   */
  [Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    return this.stream();
  }

  /**
   * EXPLAIN (ANALYZE) 결과를 반환합니다.
   * 쿼리 플랜 분석 및 인덱스 사용 여부 확인에 사용합니다.
   *
   * @param analyze - true이면 실제 실행 후 통계를 포함합니다 (기본값: false)
   *
   * @example
   * ```ts
   * const plan = await repo.select({ isActive: true }).explain(true);
   * console.log(plan);
   * ```
   */
  async explain(analyze = false): Promise<string> {
    const { sql, params } = this.buildSelectSQL();
    const prefix = analyze ? 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)' : 'EXPLAIN';
    const explainSql = `${prefix} ${sql}`;

    const rows = await QueryBuilder.raw<{ 'QUERY PLAN': string }>(explainSql, params);
    return rows.map((r) => r['QUERY PLAN']).join('\n');
  }

  /**
   * 현재 builder 상태에서 최종 SQL과 params를 반환합니다.
   * 디버깅 또는 로깅 목적으로 사용합니다.
   */
  toSQL(): { sql: string; params: unknown[] } {
    return this.buildSelectSQL();
  }

  /**
   * Raw SQL을 직접 실행합니다.
   * DB 컬럼명(snake_case) → TypeScript(camelCase) 자동 변환이 적용됩니다.
   *
   * @example
   * ```ts
   * const rows = await QueryBuilder.raw<UserRow>(
   *   'SELECT * FROM users WHERE first_name ILIKE $1',
   *   ['%john%'],
   * );
   * ```
   */
  static async raw<R extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<R[]> {
    try {
      return await withClient(async (client) => {
        logger.debug(`RAW SQL: ${sql}`, params);
        const result = await client.query(sql, params ?? []);
        return mapRows<R>(result.rows as Record<string, unknown>[]);
      });
    } catch (err) {
      throw DbError.from(err);
    }
  }

  /**
   * builder 상태를 독립적으로 복사합니다.
   * stream/forEach 내부에서 LIMIT/OFFSET을 덮어쓸 때 원본을 보호하기 위해 사용합니다.
   */
  clone(): QueryBuilder<T> {
    const c = new QueryBuilder<T>(this._table);
    c._andConds        = [...this._andConds];
    c._orConds         = [...this._orConds];
    c._orderByClauses  = [...this._orderByClauses];
    c._limitVal        = this._limitVal;
    c._offsetVal       = this._offsetVal;
    c._groupByCols     = [...this._groupByCols];
    c._joins           = [...this._joins];
    c._cols            = this._cols;
    c._execHooks       = this._execHooks;
    return c;
  }

  // ── Thenable ──────────────────────────────────────────────────────────────

  then<R>(
    onfulfilled: ((value: T[]) => R | PromiseLike<R>) | null | undefined,
    onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null | undefined,
  ): Promise<R> {
    return this.exec().then(onfulfilled, onrejected);
  }

  catch<R = never>(
    onrejected: ((reason: unknown) => R | PromiseLike<R>) | null | undefined,
  ): Promise<T[] | R> {
    return this.exec().catch(onrejected);
  }

  // ── Private builders ───────────────────────────────────────────────────────

  private buildWhereParts(): { whereSQL: string; params: unknown[] } {
    const params: unknown[] = [];
    const andParts = this._andConds.map((c) => renderCond(c, params));
    const orParts  = this._orConds.map((c) => renderCond(c, params));

    const andSQL = andParts.join(' AND ');
    const orSQL  = orParts.join(' OR ');

    let whereSQL = '';
    if (andSQL && orSQL)    whereSQL = `WHERE (${andSQL}) OR (${orSQL})`;
    else if (andSQL)        whereSQL = `WHERE ${andSQL}`;
    else if (orSQL)         whereSQL = `WHERE ${orSQL}`;

    return { whereSQL, params };
  }

  private buildJoinSQL(): string {
    return this._joins
      .map((j) => `${j.type ?? 'INNER'} JOIN ${j.table} ON ${j.on}`)
      .join(' ');
  }

  private buildGroupBySQL(): string {
    return this._groupByCols.length > 0
      ? `GROUP BY ${this._groupByCols.join(', ')}`
      : '';
  }

  private buildOrderBySQL(): string {
    return this._orderByClauses.length > 0
      ? `ORDER BY ${this._orderByClauses.map((o) => `${o.col} ${o.dir}`).join(', ')}`
      : '';
  }

  private buildSelectSQL(): { sql: string; params: unknown[] } {
    const { whereSQL, params } = this.buildWhereParts();

    const parts = [
      `SELECT ${this._cols} FROM ${this._table}`,
      this.buildJoinSQL(),
      whereSQL,
      this.buildGroupBySQL(),
      this.buildOrderBySQL(),
    ].filter(Boolean);

    if (this._limitVal !== undefined) {
      params.push(this._limitVal);
      parts.push(`LIMIT $${params.length}`);
    }
    if (this._offsetVal !== undefined) {
      params.push(this._offsetVal);
      parts.push(`OFFSET $${params.length}`);
    }

    return { sql: parts.join(' '), params };
  }

  /**
   * 공통 쿼리 실행 (훅 + 로깅 포함).
   */
  private async runQuery<R extends Record<string, unknown>>(
    sql: string,
    params: unknown[],
  ): Promise<R[]> {
    if (this._execHooks?.beforeExec) {
      await this._execHooks.beforeExec({ sql, params });
    }

    const start = Date.now();
    logger.debug(`SQL: ${sql}`, params);

    try {
      const rows = await withClient(async (client) => {
        const result = await client.query(sql, params);
        return mapRows<R>(result.rows as Record<string, unknown>[]);
      });

      const elapsed = Date.now() - start;
      logger.debug(`완료 (${elapsed}ms) rowCount=${rows.length}`);

      if (this._execHooks?.afterExec) {
        await this._execHooks.afterExec({
          rows: rows as unknown as T[],
          elapsed,
          sql,
        });
      }

      return rows;
    } catch (err) {
      const dbErr = DbError.from(err);
      logger.error(`쿼리 실패 [${this._table}]`, {
        ...dbErr.toLogContext(),
        sql,
        elapsed: `${Date.now() - start}ms`,
      });
      if (this._execHooks?.onError) {
        await this._execHooks.onError({ err: dbErr, sql, params });
      }
      throw dbErr;
    }
  }
}
