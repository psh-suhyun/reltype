/**
 * PostgreSQL 에러 분류 타입.
 * pg 라이브러리의 error.code (SQLSTATE) 기준으로 분류됩니다.
 */
export type DbErrorKind =
  | 'uniqueViolation'       // 23505 - UNIQUE 제약 위반
  | 'foreignKeyViolation'   // 23503 - FK 제약 위반
  | 'notNullViolation'      // 23502 - NOT NULL 제약 위반
  | 'checkViolation'        // 23514 - CHECK 제약 위반
  | 'deadlock'              // 40P01 - 교착 상태
  | 'serializationFailure'  // 40001 - 직렬화 실패 (재시도 가능)
  | 'connectionFailed'      // 08xxx - 연결 실패
  | 'tooManyConnections'    // 53300 - 최대 연결 수 초과
  | 'queryTimeout'          // 57014 - 쿼리 타임아웃
  | 'undefinedTable'        // 42P01 - 테이블 없음
  | 'undefinedColumn'       // 42703 - 컬럼 없음
  | 'syntaxError'           // 42601 - SQL 문법 오류
  | 'invalidInput'          // 22xxx - 잘못된 입력값
  | 'unknown';

/** pg SQLSTATE 코드 → DbErrorKind 매핑 */
const PG_CODE_TO_KIND: Record<string, DbErrorKind> = {
  '23505': 'uniqueViolation',
  '23503': 'foreignKeyViolation',
  '23502': 'notNullViolation',
  '23514': 'checkViolation',
  '40P01': 'deadlock',
  '40001': 'serializationFailure',
  '08000': 'connectionFailed',
  '08003': 'connectionFailed',
  '08006': 'connectionFailed',
  '08001': 'connectionFailed',
  '08004': 'connectionFailed',
  '53300': 'tooManyConnections',
  '57014': 'queryTimeout',
  '42P01': 'undefinedTable',
  '42703': 'undefinedColumn',
  '42601': 'syntaxError',
};

/** 사용자에게 노출할 메시지 (내부 상세 정보 미포함) */
const USER_MESSAGES: Record<DbErrorKind, string> = {
  uniqueViolation:      '이미 존재하는 값입니다.',
  foreignKeyViolation:  '참조 데이터가 존재하지 않거나, 참조 중인 데이터를 삭제할 수 없습니다.',
  notNullViolation:     '필수 값이 누락되었습니다.',
  checkViolation:       '유효하지 않은 값입니다.',
  deadlock:             '처리 중 충돌이 발생했습니다. 잠시 후 다시 시도해 주세요.',
  serializationFailure: '처리 중 충돌이 발생했습니다. 잠시 후 다시 시도해 주세요.',
  connectionFailed:     '데이터베이스에 연결할 수 없습니다.',
  tooManyConnections:   '서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.',
  queryTimeout:         '요청 처리 시간이 초과되었습니다.',
  undefinedTable:       '서버 내부 오류가 발생했습니다.',
  undefinedColumn:      '서버 내부 오류가 발생했습니다.',
  syntaxError:          '서버 내부 오류가 발생했습니다.',
  invalidInput:         '입력 형식이 올바르지 않습니다.',
  unknown:              '알 수 없는 오류가 발생했습니다.',
};

/** 재시도가 의미 있는 에러 종류 */
const RETRYABLE_KINDS: ReadonlySet<DbErrorKind> = new Set([
  'deadlock',
  'serializationFailure',
  'tooManyConnections',
  'connectionFailed',
]);

interface PgErrorLike {
  code?: string;
  table?: string;
  column?: string;
  constraint?: string;
  detail?: string;
  hint?: string;
  message?: string;
}

/** 사용자 노출용 에러 페이로드 */
export interface DbErrorPayload {
  error: string;
  kind: DbErrorKind;
  isRetryable: boolean;
}

/**
 * PostgreSQL 에러를 분류하고, 내부 에러와 사용자 노출 메시지를 분리합니다.
 *
 * @example
 * ```ts
 * try {
 *   await userRepo.create(data);
 * } catch (err) {
 *   if (err instanceof DbError) {
 *     res.status(400).json(err.toUserPayload());
 *   }
 * }
 * ```
 */
export class DbError extends Error {
  readonly kind: DbErrorKind;
  /** PostgreSQL SQLSTATE 코드 */
  readonly pgCode: string;
  /** 사용자에게 안전하게 노출 가능한 메시지 */
  readonly userMessage: string;
  /** 재시도 가능 여부 */
  readonly isRetryable: boolean;
  /** 관련 테이블명 */
  readonly table?: string;
  /** 관련 컬럼명 */
  readonly column?: string;
  /** 위반된 제약조건명 */
  readonly constraint?: string;
  /** pg가 제공하는 상세 설명 (내부 로그용) */
  readonly detail?: string;
  /** pg가 제공하는 힌트 (내부 로그용) */
  readonly hint?: string;

  private constructor(
    kind: DbErrorKind,
    pgCode: string,
    internalMessage: string,
    opts: Omit<PgErrorLike, 'code' | 'message'> = {},
  ) {
    super(internalMessage);
    this.name        = 'DbError';
    this.kind        = kind;
    this.pgCode      = pgCode;
    this.userMessage = USER_MESSAGES[kind];
    this.isRetryable = RETRYABLE_KINDS.has(kind);
    this.table       = opts.table;
    this.column      = opts.column;
    this.constraint  = opts.constraint;
    this.detail      = opts.detail;
    this.hint        = opts.hint;
  }

  /**
   * 알 수 없는 에러를 DbError로 변환합니다.
   * 이미 DbError이면 그대로 반환합니다.
   */
  static from(err: unknown): DbError {
    if (err instanceof DbError) return err;

    const pg = err as PgErrorLike;
    const code = pg.code ?? 'UNKNOWN';

    const kind: DbErrorKind =
      PG_CODE_TO_KIND[code] ??
      (code.startsWith('22') ? 'invalidInput' : 'unknown');

    return new DbError(kind, code, pg.message ?? 'Unknown database error', {
      table:      pg.table,
      column:     pg.column,
      constraint: pg.constraint,
      detail:     pg.detail,
      hint:       pg.hint,
    });
  }

  /**
   * 사용자에게 안전하게 노출할 수 있는 정보만 담은 객체를 반환합니다.
   * Express response 등에서 직접 사용하세요.
   */
  toUserPayload(): DbErrorPayload {
    return {
      error:       this.userMessage,
      kind:        this.kind,
      isRetryable: this.isRetryable,
    };
  }

  /**
   * 내부 로깅용 컨텍스트를 반환합니다.
   * 절대 사용자에게 직접 노출하지 마세요.
   */
  toLogContext(): Record<string, unknown> {
    return {
      pgCode:     this.pgCode,
      kind:       this.kind,
      table:      this.table,
      column:     this.column,
      constraint: this.constraint,
      detail:     this.detail,
      hint:       this.hint,
      message:    this.message,
    };
  }
}
