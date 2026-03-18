/** WHERE 조건 연산자 */
export type WhereOp =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'ILIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL';

/**
 * 고급 WHERE 조건값.
 * `{ operator: 'LIKE', value: '%search%' }` 형태로 사용합니다.
 */
export interface WhereVal<T> {
  operator: WhereOp;
  /** IS NULL / IS NOT NULL 일 때는 생략 가능 */
  value?: T | T[];
}

/**
 * 고급 WHERE 조건 입력 타입.
 * 단순 값(등호 조건) 또는 `WhereVal`(연산자 지정) 모두 허용합니다.
 *
 * @example
 * ```ts
 * // 등호
 * { isActive: true }
 * // LIKE
 * { email: { operator: 'LIKE', value: '%@gmail.com' } }
 * // IN
 * { id: { operator: 'IN', value: [1, 2, 3] } }
 * // NULL 체크
 * { deletedAt: { operator: 'IS NULL' } }
 * ```
 */
export type AdvancedWhere<T> = {
  [K in keyof T]?: T[K] | WhereVal<T[K]>;
};

/** JOIN 종류 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

/**
 * JOIN 절 정의.
 *
 * @example
 * ```ts
 * repo.select()
 *   .join({ table: 'orders', on: 'users.id = orders.user_id', type: 'LEFT' })
 * ```
 */
export interface JoinClause {
  table: string;
  /** ON 절 (snake_case 컬럼명으로 직접 작성) */
  on: string;
  type?: JoinType;
}

/** 집계 함수 종류 */
export type AggregateFn = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

/**
 * 집계 함수 정의.
 *
 * @example
 * ```ts
 * .calculate([
 *   { fn: 'COUNT', alias: 'count' },
 *   { fn: 'AVG',   column: 'price', alias: 'avgPrice' },
 * ])
 * ```
 */
export interface AggregateCalc {
  fn: AggregateFn;
  /** 대상 컬럼 (생략 시 *) */
  column?: string;
  alias: string;
}

/** 페이지네이션 입력 옵션 */
export interface PaginateOpts {
  page: number;
  pageSize: number;
}

/**
 * 페이지네이션 결과.
 *
 * @example
 * ```ts
 * {
 *   data: [...],
 *   count: 150,
 *   page: 2,
 *   pageSize: 20,
 *   nextAction: true,
 *   previousAction: true
 * }
 * ```
 */
export interface PageResult<T> {
  data: T[];
  /** 필터 조건에 해당하는 전체 row 수 */
  count: number;
  page: number;
  pageSize: number;
  /** 다음 페이지가 존재하는지 여부 */
  nextAction: boolean;
  /** 이전 페이지가 존재하는지 여부 */
  previousAction: boolean;
}

/** ORDER BY 절 */
export interface OrderByClause<T = Record<string, unknown>> {
  column: keyof T | string;
  direction?: 'ASC' | 'DESC';
}

/** 내부 조건 저장 포맷 (실행 시 SQL 생성) */
export interface RawCond {
  col: string;
  op: WhereOp;
  val?: unknown;
}

// ── 대용량 데이터 처리 ──────────────────────────────────────────────────────

/**
 * 커서 기반(Keyset) 페이지네이션 옵션.
 *
 * OFFSET 방식 대비 대용량 테이블에서 일정한 성능을 보장합니다.
 * 인덱스가 걸린 컬럼(id, createdAt 등)을 cursorColumn으로 지정하세요.
 *
 * @example
 * ```ts
 * // 첫 번째 페이지
 * const p1 = await repo.select().cursorPaginate({ pageSize: 20, cursorColumn: 'id' });
 * // 다음 페이지
 * const p2 = await repo.select().cursorPaginate({ pageSize: 20, cursorColumn: 'id', cursor: p1.nextCursor });
 * ```
 */
export interface KeysetPaginateOpts {
  pageSize: number;
  /** 이전 페이지 결과의 nextCursor 값 (최초 요청 시 생략) */
  cursor?: string;
  /** 커서로 사용할 컬럼 (camelCase, 인덱스가 존재해야 합니다) */
  cursorColumn: string;
  direction?: 'asc' | 'desc';
}

/** 커서 기반 페이지네이션 결과 */
export interface KeysetPageResult<T> {
  data: T[];
  /** 다음 페이지 요청 시 cursor 파라미터로 전달하세요. null이면 마지막 페이지입니다. */
  nextCursor: string | null;
  pageSize: number;
  hasNext: boolean;
}

/**
 * 배치 스트리밍 옵션.
 * 대용량 데이터를 메모리에 전부 로드하지 않고 청크 단위로 처리합니다.
 */
export interface StreamOpts {
  /** 한 번에 DB에서 읽어올 row 수 (기본값: 500) */
  batchSize?: number;
}

// ── 훅(Hook) 시스템 ────────────────────────────────────────────────────────

/**
 * 쿼리 실행 라이프사이클 훅.
 *
 * @example
 * ```ts
 * repo.select()
 *   .hooks({
 *     beforeExec: ({ sql }) => logger.debug('실행 예정 SQL:', sql),
 *     afterExec:  ({ rows, elapsed }) => metrics.record('query', elapsed),
 *     onError:    ({ err }) => alerting.send(err),
 *   })
 *   .paginate({ page: 1, pageSize: 20 });
 * ```
 */
export interface ExecHooks<T extends Record<string, unknown> = Record<string, unknown>> {
  beforeExec?: (ctx: { sql: string; params: unknown[] }) => void | Promise<void>;
  afterExec?:  (ctx: { rows: T[]; elapsed: number; sql: string }) => void | Promise<void>;
  onError?:    (ctx: { err: Error; sql: string; params: unknown[] }) => void | Promise<void>;
}
