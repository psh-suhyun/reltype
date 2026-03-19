import { Logger } from './logger';
import { AggregateFn, JoinType } from '../features/query/interfaces/Advanced';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[SqlGuard]' },
);

/**
 * 유효한 SQL 식별자 패턴.
 * - 단순 식별자: `[a-zA-Z_][a-zA-Z0-9_]*`  예: `first_name`, `userId`
 * - 점 표기법:   `schema.table`, `table.column`
 *
 * 공백, 세미콜론, 따옴표, 괄호 등 SQL 특수문자를 포함하는 경우 거부합니다.
 */
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

const VALID_ORDER_DIRS  = new Set<string>(['ASC', 'DESC']);
const VALID_AGG_FNS     = new Set<string>(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);
const VALID_JOIN_TYPES  = new Set<string>(['INNER', 'LEFT', 'RIGHT', 'FULL']);

/**
 * SQL 식별자(컬럼명, 테이블명 등)를 검증하고 PostgreSQL 표준으로 이스케이프합니다.
 *
 * - 유효한 식별자 패턴 `[a-zA-Z_][a-zA-Z0-9_.]*` 에 맞지 않으면
 *   `logger.error` 로 기록하고 `""` (빈 식별자) 를 반환합니다.
 * - `"` 문자는 `""` 로 이중 이스케이프합니다 (PostgreSQL 표준).
 * - `schema.table` / `table.column` 도트 표기법을 지원합니다.
 *
 * @example
 * quoteIdentifier('first_name')   // → '"first_name"'
 * quoteIdentifier('auth.users')   // → '"auth"."users"'
 * quoteIdentifier('1; DROP TABLE')// → '""' + logger.error
 */
export function quoteIdentifier(raw: string): string {
  if (!IDENTIFIER_RE.test(raw)) {
    logger.error(
      `유효하지 않은 SQL 식별자 "${raw}". ` +
      `허용 패턴: [a-zA-Z_][a-zA-Z0-9_]*(.[a-zA-Z_][a-zA-Z0-9_]*)*. ` +
      `빈 식별자("")로 대체합니다.`,
    );
    return '""';
  }
  return raw
    .split('.')
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join('.');
}

/**
 * 개발자가 정의하는 테이블/스키마 식별자를 이스케이프합니다.
 * 패턴 검증 없이 `"` → `""` 이중 이스케이프만 수행합니다.
 *
 * `defineTable` 내부에서만 사용합니다 (개발자가 제어하는 정적 값).
 *
 * @example
 * escapeSchemaIdentifier('auth')     // → '"auth"'
 * escapeSchemaIdentifier('my"table') // → '"my""table"'
 */
export function escapeSchemaIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * ORDER BY 방향(ASC / DESC)을 검증합니다.
 * 유효하지 않으면 `logger.error` 후 `'ASC'` 를 반환합니다.
 */
export function validateOrderDir(dir: string): 'ASC' | 'DESC' {
  const upper = dir.toUpperCase();
  if (!VALID_ORDER_DIRS.has(upper)) {
    logger.error(
      `유효하지 않은 ORDER BY 방향 "${dir}". 허용 값: ASC, DESC. 'ASC'로 대체합니다.`,
    );
    return 'ASC';
  }
  return upper as 'ASC' | 'DESC';
}

/**
 * 집계 함수명(COUNT / SUM / AVG / MIN / MAX)을 검증합니다.
 * 유효하지 않으면 `logger.error` 후 `'COUNT'` 를 반환합니다.
 */
export function validateAggregateFn(fn: string): AggregateFn {
  const upper = fn.toUpperCase();
  if (!VALID_AGG_FNS.has(upper)) {
    logger.error(
      `유효하지 않은 집계 함수 "${fn}". 허용 값: COUNT, SUM, AVG, MIN, MAX. 'COUNT'로 대체합니다.`,
    );
    return 'COUNT';
  }
  return upper as AggregateFn;
}

/**
 * JOIN 타입(INNER / LEFT / RIGHT / FULL)을 검증합니다.
 * 유효하지 않으면 `logger.error` 후 `'INNER'` 를 반환합니다.
 */
export function validateJoinType(type: string): JoinType {
  const upper = type.toUpperCase();
  if (!VALID_JOIN_TYPES.has(upper)) {
    logger.error(
      `유효하지 않은 JOIN 타입 "${type}". 허용 값: INNER, LEFT, RIGHT, FULL. 'INNER'로 대체합니다.`,
    );
    return 'INNER';
  }
  return upper as JoinType;
}
